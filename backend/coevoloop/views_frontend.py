"""
Frontend view - serves the React/Vue SPA
"""
from django.shortcuts import render
from django.views.generic import View
from django.http import HttpResponse
import os
from pathlib import Path


class FrontendAppView(View):
    """
    服务React前端应用的视图
    """
    
    def get(self, request):
        # 构建前端构建文件的路径
        frontend_dir = Path(__file__).resolve().parent.parent.parent / 'viewer' / 'dist'
        index_path = frontend_dir / 'index.html'
        
        if index_path.exists():
            with open(index_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 替换静态资源路径，确保使用正确的静态文件路径
            content = content.replace('src="/assets/', 'src="/static/assets/')
            content = content.replace('href="/assets/', 'href="/static/assets/')
            content = content.replace('href="/favicon.ico"', 'href="/static/favicon.ico"')
            content = content.replace('href="/alisa-avatar.jpg"', 'href="/static/alisa-avatar.jpg"')
            content = content.replace('src="/favicon.ico"', 'src="/static/favicon.ico"')
            content = content.replace('src="/alisa-avatar.jpg"', 'src="/static/alisa-avatar.jpg"')
            content = content.replace('href="/worldfirst.png"', 'href="/static/worldfirst.png"')
            content = content.replace('src="/worldfirst.png"', 'src="/static/worldfirst.png"')
            content = content.replace('href="/worldfirst-logo.png"', 'href="/static/worldfirst-logo.png"')
            content = content.replace('src="/worldfirst-logo.png"', 'src="/static/worldfirst-logo.png"')
            content = content.replace('href="/worldfirst-avatar.png"', 'href="/static/worldfirst-avatar.png"')
            content = content.replace('src="/worldfirst-avatar.png"', 'src="/static/worldfirst-avatar.png"')
            content = content.replace('href="/placeholder.svg"', 'href="/static/placeholder.svg"')
            content = content.replace('src="/placeholder.svg"', 'src="/static/placeholder.svg"')
            
            return HttpResponse(content)
        else:
            return HttpResponse(
                """
                <h1>前端应用未构建</h1>
                <p>请先运行以下命令构建前端：</p>
                <pre>cd viewer && npm install && npm run build</pre>
                <p>然后重启服务</p>
                """,
                status=404
            )


class StaticFileView(View):
    """
    服务静态文件的视图
    """
    
    def get(self, request, path):
        frontend_dir = Path(__file__).resolve().parent.parent.parent / 'viewer' / 'dist'
        file_path = frontend_dir / path
        
        if file_path.exists() and file_path.is_file():
            with open(file_path, 'rb') as f:
                content = f.read()
            
            # 根据文件扩展名设置正确的Content-Type
            if path.endswith('.js'):
                content_type = 'application/javascript'
            elif path.endswith('.css'):
                content_type = 'text/css'
            elif path.endswith('.png'):
                content_type = 'image/png'
            elif path.endswith('.jpg') or path.endswith('.jpeg'):
                content_type = 'image/jpeg'
            elif path.endswith('.svg'):
                content_type = 'image/svg+xml'
            elif path.endswith('.ico'):
                content_type = 'image/x-icon'
            else:
                content_type = 'text/plain'
            
            return HttpResponse(content, content_type=content_type)
        else:
            return HttpResponse("File not found", status=404)
