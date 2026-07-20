from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.post("/test")
def test_endpoint(data: dict):
    return {"status": "success", "received": data}
