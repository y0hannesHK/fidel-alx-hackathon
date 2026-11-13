# Standalone container for testing English -> Amharic translation quality.
# Not part of the Fidel server. See README.md in this folder.
FROM python:3.11-slim
WORKDIR /eval
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY translate.py sentences.txt ./
CMD ["python", "translate.py"]
