import asyncio
import websockets
import json


async def test():
    uri = "ws://localhost:5000/api/v1/ws/stress"
    print(f"Connecting to {uri}...")
    async with websockets.connect(uri) as ws:
        print("Connected. Waiting for messages...")
        for i in range(3):
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=15)
                data = json.loads(msg)
                msg_type = data.get("type")
                score = data.get("score")
                level = data.get("level")
                print(f"Msg {i + 1}: type={msg_type}, score={score}, level={level}")
            except asyncio.TimeoutError:
                print(f"Msg {i + 1}: TIMEOUT (no data in 15s)")
    print("Done")


asyncio.run(test())
