FROM python:3.14-slim
RUN apt-get update && apt-get install -y tar && rm -rf /var/lib/apt/lists/*
ADD requirements.txt requirements.txt
RUN pip install -r requirements.txt
ADD app.py app.py
CMD ["python", "app.py"]
