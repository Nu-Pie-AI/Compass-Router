FROM python:3.12-slim

WORKDIR /app
COPY apps/api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
RUN addgroup --system compass && adduser --system --ingroup compass compass
COPY --chown=compass:compass apps/api/app /app/app
COPY --chown=compass:compass apps/api/alembic.ini /app/alembic.ini
COPY --chown=compass:compass apps/api/alembic /app/alembic
USER compass
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
