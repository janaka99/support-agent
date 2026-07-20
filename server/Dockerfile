FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# In development, we'll mount the code, so no need to COPY everything.
# We'll run the server using the fastapi CLI for hot-reloading.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
