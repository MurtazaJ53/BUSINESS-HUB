import os

# Binding
bind = "0.0.0.0:8000"

# Workers & Threads
#
# The old value was cpu_count() * 2 + 1. Two problems on a small box:
#   - inside a container, cpu_count() reports the HOST's CPUs, not the
#     container's share, so it over-provisions silently
#   - each gthread worker is a full Django process (~120-180 MB here), so on a
#     2 vCPU droplet that is 5 workers and most of a 900 MB limit spent on
#     idle processes
#
# 2 workers x 4 threads serves 8 concurrent requests. A single shop issuing a
# few hundred bills a day never approaches that, and the memory is better spent
# on Postgres cache. Raise GUNICORN_WORKERS when the traffic justifies it.
workers = int(os.getenv("GUNICORN_WORKERS", "2"))
threads = int(os.getenv("GUNICORN_THREADS", "4"))
worker_class = "gthread"
# Recycle workers periodically so a slow leak cannot grow unbounded on a box
# with little headroom. The jitter stops all workers restarting together.
max_requests = 1000
max_requests_jitter = 100

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
