FROM python:3.12-slim

WORKDIR /app
COPY . .

ENV HOST=0.0.0.0
ENV PORT=8000
ENV PROME_LAW_DATA_DIR=/data

EXPOSE 8000
CMD ["python", "server.py"]
