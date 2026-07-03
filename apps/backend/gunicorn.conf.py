import multiprocessing
import os

# Binding
bind = "0.0.0.0:8000"

# Workers & Threads
# We use gevent or threads for async I/O. Django handles DB mostly, but since it's a high-throughput API, threads are good.
workers = multiprocessing.cpu_count() * 2 + 1
threads = 4
worker_class = "gthread"

# Timeout for workers
timeout = 120
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")

# OpenTelemetry configuration hooking could go here if needed in post_fork
def post_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)
