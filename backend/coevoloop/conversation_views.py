import logging
import os
import json
import sys
import time
import asyncio
import uuid

from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect, StreamingHttpResponse
from typing import Dict, Optional
from django.conf import settings
from dotenv import load_dotenv
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.views.decorators.csrf import csrf_exempt
from urllib.parse import unquote

from core.dialogue_demo.online_one_model import online_one_model_response

from storage.conversation_storage import get_conversation_storage


logger = logging.getLogger(__name__)


def get_user_id_from_cookie(user_id, request):
    if user_id == "default_user" and request.COOKIES.get("authorization"):
        user_id = request.COOKIES["authorization"]
        user_id = unquote(user_id).split(":")[0]
    return user_id


@api_view(['POST'])
@csrf_exempt
def conversation_create_api(request):
    """创建新会话"""
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id', 'default_user')
        user_id = get_user_id_from_cookie(user_id, request)

        title = data.get('title', f"new conversation")
        model = data.get('model')
        service = data.get('service')
        conversation_id = data.get('conversation_id')

        storage = get_conversation_storage()
        conversation = storage.create_conversation(
            user_id=user_id,
            title=title,
            model=model,
            service=service,
            conversation_id=conversation_id
        )

        return Response({
            'id': conversation['conversation_id'],
            'title': conversation['title'],
            'model': conversation['model'],
            'created_at': conversation['created_at'],
            'updated_at': conversation['updated_at'],
            'message_count': 0
        })
    except Exception as e:
        logger.error(f"Error creating conversation: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def conversation_detail_api(request, conversation_id):
    """获取会话详情和消息历史（从数据库）"""
    try:
        user_id = request.GET.get('user_id', 'default_user')
        user_id = get_user_id_from_cookie(user_id, request)

        storage = get_conversation_storage()
        conversation = storage.load_conversation(user_id, conversation_id)

        if conversation is None:
            return Response(
                {'error': '会话不存在'},
                status=status.HTTP_404_NOT_FOUND
            )

        # 格式化消息列表
        messages = [
            {
                'id': msg.get('message_id'),
                'role': msg['role'],
                'content': msg['content'],
                'timestamp': msg['timestamp']
            }
            for msg in conversation.get('messages', [])
        ]

        return Response({
            'id': conversation['conversation_id'],
            'title': conversation['title'],
            'model': conversation.get('model'),
            'created_at': conversation['created_at'],
            'updated_at': conversation['updated_at'],
            'messages': messages
        })

    except Exception as e:
        logger.error(f"Error fetching conversation detail: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@csrf_exempt
def send_message_api(request, conversation_id):
    """发送消息到指定会话（流式响应 - 使用数据库）"""
    try:

        data = json.loads(request.body)
        logger.info(data)
        user_id = data.get('user_id', 'default_user')
        content = data.get('content', '')
        service = data.get('service', '')
        score_model = data.get('score_model', '')
        user_simulator_model = data.get('user_simulator_model', '')
        turn = data.get('turn', 0)
        outer_user_goal = data.get('outer_user_goal', '')

        if not content.strip():
            return JsonResponse(
                {'error': '消息内容不能为空'},
                status=400,
                json_dumps_params={'ensure_ascii': False}
            )

        storage = get_conversation_storage()
        conversation = storage.load_conversation(user_id, conversation_id)

        if conversation is None:
            return JsonResponse(
                {'error': '会话不存在'},
                status=404,
                json_dumps_params={'ensure_ascii': False}
            )

        async def generate_response():
            """异步生成响应流"""
            try:
                # 1. 添加用户消息
                storage.add_message(user_id, conversation_id, "user", content)

                # 2. 重新加载对话以获取完整历史
                conversation = storage.load_conversation(user_id, conversation_id)

                # 3. 构建历史消息列表（online_one_model_response 需要的格式）
                history = [
                    {"role": msg["role"], "content": msg["content"]}
                    for msg in conversation["messages"][:-1]  # 排除刚添加的用户消息
                ]

                # 4. 调用 LLM 获取响应
                logger.info(
                    f"🤖 调用 LLM: user={user_id}, conversation={conversation_id}, history_len={len(history)}, model={service}")
                result = await online_one_model_response(
                    model_name=service,
                    context=history,
                    turn=turn,
                    history=history,
                    query=content
                )

                response_content = result["answer"]
                planner_records = result.get("planner_record", [])

                logger.info(f"✅ LLM 响应: length={len(response_content)}")

                # 5. 添加助手消息
                storage.add_message(user_id, conversation_id, "assistant", response_content)

                # 6. 保存 planner_record
                for record in planner_records:
                    record['turn'] = turn
                    record['outer_user_goal'] = outer_user_goal
                    record['score_model'] = score_model
                    record['user_simulator_model'] = user_simulator_model
                    storage.add_planner_record(user_id, conversation_id, record)

                # 7. 发送流式响应
                yield f"data: {json.dumps({'type': 'message_start'})}\n\n"
                yield f"data: {json.dumps({'type': 'content', 'content': response_content})}\n\n"
                yield f"data: {json.dumps({'type': 'message_end'})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"

            except Exception as e:
                logger.error(f"❌ 生成响应失败: {str(e)}", exc_info=True)
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

        def sync_generator():
            """同步包装器，用于 StreamingHttpResponse"""
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                async_gen = generate_response()
                while True:
                    try:
                        chunk = loop.run_until_complete(async_gen.__anext__())
                        yield chunk
                    except StopAsyncIteration:
                        break
            finally:
                loop.close()

        response = StreamingHttpResponse(
            sync_generator(),
            content_type='text/event-stream; charset=utf-8'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    except Exception as e:
        logger.error(f"❌ 发送消息失败: {str(e)}", exc_info=True)
        return JsonResponse(
            {'error': str(e)},
            status=500,
            json_dumps_params={'ensure_ascii': False}
        )


@api_view(['GET'])
def users_api(request):
    """获取用户数据（从user.jsonl文件）"""
    try:
        # 读取user.jsonl文件
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        user_file = os.path.join(base_dir, 'resource', 'user.jsonl')

        if not os.path.exists(user_file):
            return Response({'error': 'User data file not found'}, status=status.HTTP_404_NOT_FOUND)

        users = []
        with open(user_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        user = json.loads(line)
                        users.append(user)
                    except json.JSONDecodeError as e:
                        logger.warning(f"Skipping invalid JSON line: {line}, error: {e}")

        return Response({'users': users})

    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@csrf_exempt
def conversation_score_detail_api(request, conversation_id):
    """获取会话中某一轮的评分详情"""
    try:
        user_id = request.GET.get('user_id', 'default_user')
        user_id = get_user_id_from_cookie(user_id, request)

        user_info = request.GET.get('user_info', {})
        if user_info:
            user_info = json.loads(user_info)
        login_status = user_info.get("登陆状态")
        if login_status == "已登陆":
            identity = "Yes"
        else:
            identity = user_info.get("identity", "Yes")

        turn = request.GET.get('turn', 0)
        score_model = request.GET.get('score_model', '')  # 从请求中获取打分器模型

        # 使用数据库存储
        storage = get_conversation_storage()
        conversation = storage.load_conversation(user_id, conversation_id)

        if conversation is None:
            return Response(
                {'error': '会话不存在'},
                status=status.HTTP_404_NOT_FOUND
            )

        # 转换消息格式
        messages = [
            {
                'id': msg.get('message_id'),
                'role': msg['role'],
                'content': msg['content'],
                'timestamp': msg['timestamp']
            }
            for msg in conversation.get('messages', [])
        ]

        from core.dialogue_demo import online_evaluate
        score_detail = {
            "打分器调用错误": "nan",
        }

        if messages and isinstance(messages, list) and len(messages) >= 2:
            try:
                history = [
                    {"role": msg['role'], "content": msg['content']}
                    for msg in messages
                ]
                ext = conversation.get('ext', {})

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    result = loop.run_until_complete(online_evaluate(history, ext, score_model=score_model or None))
                    if result:
                        score_detail = result
                finally:
                    loop.close()
            except Exception as e:
                logger.warning(f"⚠️ 评分失败: {str(e)}")

        return Response({
            'score_detail': score_detail,
            'scorer_version': "v4.8",
            'score_model': score_model or "default"
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.error(f"Error fetching score detail: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@csrf_exempt
def generate_user_input_api(request):
    """生成用户输入API - 调用fintl_ai的online_generate_user_input函数"""
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id', 'default_user')
        user_id = get_user_id_from_cookie(user_id, request)

        conversation_id = data.get('conversation_id')
        user_data = data.get('user_data')
        turn = data.get('turn', 0)
        turn += 1


        if not conversation_id:
            return JsonResponse({'error': '缺少conversation_id参数'}, status=400, json_dumps_params={'ensure_ascii': False})

        async def get_user_input(user_id,
                                 conversation_id,
                                 user_data,
                                 turn):
            storage = get_conversation_storage()
            conversation = storage.load_conversation(user_id, conversation_id)

            from core.dialogue_demo import online_generate_user_input
            history = [
                {"role": msg["role"], "content": msg["content"]}
                for msg in conversation["messages"][:-1]  # 排除刚添加的用户消息
            ]

            result = await online_generate_user_input(
                user_data=user_data, history=history, turn=turn
            )
            user_input = result.get('user_input')
            end = result.get('end', False)

            # print("history", history)
            if user_input and len(history) >= 2:
                if user_input.strip() == history[-2]["content"]:
                    end = True
            result['end'] = end
            result['user_input'] = user_input
            return result

        # 在同步视图中运行异步逻辑
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(get_user_input(user_id, conversation_id, user_data, turn))
        finally:
            loop.close()

        logger.info(f"Generated user input result: {result}")

        return JsonResponse({
            'user_input': result.get('user_input', ''),
            'end': result.get('end', False),
            'user_simulator_version': "v3"
        }, json_dumps_params={'ensure_ascii': False})

    except Exception as e:
        logger.exception(e)
        logger.error(f"Error generating user input: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500, json_dumps_params={'ensure_ascii': False})
