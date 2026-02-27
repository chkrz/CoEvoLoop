#!/usr/bin/env python3
"""
LinkReplacer - 用于替换字符串中的HTTP/HTTPS链接为@@link{idx}格式
支持多进程并发安全操作 + 性能优化版
"""

import json
import re
import os
import fcntl
import time
from pathlib import Path


import json
from typing import Optional, List, Dict, Union, Tuple


class LinkReplacer:
    """
    链接替换器类 - 完全并发安全 + 性能优化版

    功能：
    1. 将字符串中的http/https链接替换为@@link{idx}格式
    2. 维护链接到idx的映射关系
    3. 支持多进程并发安全操作
    4. 性能优化：只读场景无锁读取
    5. idx为3-6位数字，每个链接对应唯一idx
    """

    def __init__(self, mapping_file: str = "link_mapping.json"):
        """
        初始化LinkReplacer

        Args:
            mapping_file: 映射文件路径，默认为link_mapping.json
        """
        self.mapping_file = Path(mapping_file)
        self.lock_file = self.mapping_file.with_suffix('.lock')

        # 确保映射文件存在
        self._init_mapping_file()

    def _init_mapping_file(self):
        """初始化映射文件（如果不存在）"""
        if not self.mapping_file.exists():
            self.mapping_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.mapping_file, 'w', encoding='utf-8') as f:
                json.dump({}, f, ensure_ascii=False, indent=2)

    def _extract_links(self, text: str) -> List[str]:
        """
        从文本中提取所有HTTP/HTTPS链接

        Args:
            text: 输入文本

        Returns:
            List[str]: 链接列表（去重）
        """
        if not text:
            return []

        # 匹配HTTP/HTTPS链接的正则表达式
        url_pattern = r'https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?'
        # url_pattern = r'https?://(?:[^\s<>\]\[()\'"]+|\([^\s<>\'"]*\))+(?=[\s\]>)}\'",.:!?]|$)'
        links = re.findall(url_pattern, text)
        return list(set(links))  # 去重

    def _load_mapping_safe(self) -> Dict[str, str]:
        """
        安全地读取映射文件（无锁读取，用于只读场景）

        Returns:
            Dict[str, str]: 链接到idx的映射
        """
        try:
            with open(self.mapping_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    return {}
                return json.loads(content)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def _load_mapping_with_lock(self) -> Dict[str, str]:
        """
        在锁保护下读取映射文件（用于写操作）

        Returns:
            Dict[str, str]: 链接到idx的映射
        """
        with self._file_lock():
            return self._load_mapping_safe()

    def _generate_unique_idx(self, existing_idxs: set, count: int = 1) -> List[str]:
        """
        生成唯一的3-6位数字idx

        Args:
            existing_idxs: 已存在的idx集合
            count: 需要生成的idx数量

        Returns:
            List[str]: 新的唯一idx列表
        """
        import random

        # 3-6位数字的范围
        min_val = 100
        max_val = 999999

        new_idxs = []
        attempts = 0
        max_attempts = 1000

        while len(new_idxs) < count and attempts < max_attempts:
            candidate = int(random.randint(min_val, max_val))
            if candidate not in existing_idxs:
                new_idxs.append(candidate)
                existing_idxs.add(candidate)
            attempts += 1

        # 如果随机生成失败，使用顺序生成
        if len(new_idxs) < count:
            for i in range(min_val, max_val + 1):
                idx = int(i)
                if idx not in existing_idxs:
                    new_idxs.append(idx)
                    existing_idxs.add(idx)
                    if len(new_idxs) >= count:
                        break

        if len(new_idxs) < count:
            # 扩展范围到7位数字
            min_val = 1000000
            max_val = 9999999
            for i in range(min_val, max_val + 1):
                idx = int(i)
                if idx not in existing_idxs:
                    new_idxs.append(idx)
                    existing_idxs.add(idx)
                    if len(new_idxs) >= count:
                        break

        if len(new_idxs) < count:
            raise RuntimeError("无法生成足够的唯一idx")

        return new_idxs

    def replace_links(self, text: str) -> str:
        """
        替换文本中的链接为@@link{idx}格式（性能优化版）

        优化策略：
        1. 如果所有链接都已存在映射，使用无锁读取
        2. 如果有新链接，才使用文件锁进行写操作

        Args:
            text: 输入文本

        Returns:
            str: 替换后的文本
        """
        if not text:
            return text

        # 提取所有链接
        links = self._extract_links(text)
        if not links:
            return text

        # 首先尝试无锁读取（性能优化）
        mapping = self._load_mapping_safe()

        # 检查是否所有链接都已存在映射
        existing_links = [link for link in links if link in mapping]
        if len(existing_links) == len(links):
            # 所有链接都已存在，直接替换（无锁操作）
            result = text
            for link in links:
                # replacement = f"@@link{{{mapping[link]}}}"
                replacement = f"@@link{mapping[link]}%%"
                pattern = re.escape(link)
                result = re.sub(pattern, replacement, result)
            return result

        # 有需要处理的新链接，使用文件锁
        with self._file_lock():
            # 重新读取映射（可能已被其他进程更新）
            mapping = self._load_mapping_safe()

            # 再次检查新链接（双重检查）
            new_links = [link for link in links if link not in mapping]

            if new_links:
                # 获取所有已存在的idx
                existing_idxs = set(mapping.values())

                # 为新链接生成唯一idx
                new_idxs = self._generate_unique_idx(existing_idxs, len(new_links))

                # 更新映射
                for link, idx in zip(new_links, new_idxs):
                    mapping[link] = idx

                # 原子性保存映射
                self._atomic_save(mapping)

            # 构建替换映射
            link_to_replacement = {
                link: f"@@link{mapping[link]}%%"
                # link: f"@@link{{{mapping[link]}}}"
                for link in links
            }

        # 在锁外进行文本替换
        result = text
        for link, replacement in link_to_replacement.items():
            pattern = re.escape(link)
            result = re.sub(pattern, replacement, result)

        return result

    def _atomic_save(self, mapping: Dict[str, str]) -> None:
        """
        原子性保存映射到文件

        Args:
            mapping: 链接到idx的映射
        """
        temp_file = self.mapping_file.with_suffix('.tmp')

        try:
            # 写入临时文件
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(mapping, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())

            # 原子性替换原文件
            os.replace(temp_file, self.mapping_file)

        except Exception as e:
            # 清理临时文件
            if temp_file.exists():
                temp_file.unlink()
            raise RuntimeError(f"保存映射文件失败: {e}")

    def get_link_by_idx(self, idx: int) -> Optional[str]:
        """
        根据idx获取对应的链接（无锁读取）

        Args:
            idx: 链接索引

        Returns:
            Optional[str]: 对应的链接，如果不存在返回None
        """
        mapping = self._load_mapping_safe()
        for link, link_idx in mapping.items():
            if link_idx == idx:
                return link
        return None

    def replace_links_back(self, text: str) -> str:
        matches = re.findall("@@link(.*?)%%", text, re.DOTALL)
        for match in matches:
            link = self.get_link_by_idx(int(match))
            if link:
                text = text.replace(f"@@link{match}%%", link)
            else:
                print(f"模型幻觉，不存在的链接 {match}")
        return text

    def get_all_mappings(self) -> Dict[str, str]:
        """
        获取所有链接映射（无锁读取）

        Returns:
            Dict[str, str]: 链接到idx的完整映射
        """
        return self._load_mapping_safe()

    def clear_mappings(self) -> bool:
        """
        清空所有映射关系

        Returns:
            bool: 是否成功清空
        """
        try:
            with self._file_lock():
                self._atomic_save({})
            return True
        except Exception:
            return False

    def _file_lock(self):
        """返回文件锁上下文管理器"""
        return FileLock(self.lock_file)


class FileLock:
    """文件锁上下文管理器"""

    def __init__(self, lock_file: Path, timeout: float = 10.0):
        self.lock_file = lock_file
        self.timeout = timeout
        self.file_obj = None

    def __enter__(self):
        self.file_obj = open(self.lock_file, 'w')
        start_time = time.time()

        while True:
            try:
                # 尝试获取独占锁
                fcntl.flock(self.file_obj.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except (IOError, OSError):
                if time.time() - start_time > self.timeout:
                    self.file_obj.close()
                    raise RuntimeError("无法获取文件锁，超时")
                time.sleep(0.01)

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.file_obj:
            try:
                fcntl.flock(self.file_obj.fileno(), fcntl.LOCK_UN)
            except (IOError, OSError):
                pass
            self.file_obj.close()
