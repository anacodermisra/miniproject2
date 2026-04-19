#!/bin/bash
cd backend
pip install -r requirements.txt
gunicorn app.main:app -w 4 -b 0.0.0.0:$PORT