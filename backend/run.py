import uvicorn
import os
from app.core.config import settings

if __name__ == "__main__":
    is_dev = settings.ENVIRONMENT == "development"
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=is_dev,
        log_level="info",
    )
