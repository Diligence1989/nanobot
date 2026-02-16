只启动后端：
在当前目录：
nonobot agent

启动前后端：在当前目录下
nanobot web --port 18800

后台启动：
nohup nanobot web --port 18800 > /tmp/nanobot-web.log 2>&1 &
