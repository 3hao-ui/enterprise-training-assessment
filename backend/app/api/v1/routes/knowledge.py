"""知识库文档路由"""

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.core.auth import get_current_user
from app.models.common import ApiResponse
from app.services import knowledge_service

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.post("/documents", response_model=ApiResponse)
async def upload_document(
    file: UploadFile = File(...),
    file_name: str | None = Form(
        None, description="客户端显式指定的原始文件名；小程序会丢失 multipart filename"
    ),
    user_id: int = Depends(get_current_user),
):
    content = await file.read()
    result = await knowledge_service.handle_upload(
        user_id=user_id,
        filename=file_name or file.filename or "unknown",
        content=content,
    )
    return ApiResponse.success(data=result.model_dump())


@router.get("/documents", response_model=ApiResponse)
async def list_documents(user_id: int = Depends(get_current_user)):
    result = await knowledge_service.list_documents(user_id)
    return ApiResponse.success(data=result.model_dump())


@router.get("/documents/{doc_id}", response_model=ApiResponse)
async def get_document_status(doc_id: str, user_id: int = Depends(get_current_user)):
    result = await knowledge_service.get_document_status(user_id, doc_id)
    return ApiResponse.success(data=result.model_dump())


@router.delete("/documents/{doc_id}", response_model=ApiResponse)
async def delete_document(doc_id: str, user_id: int = Depends(get_current_user)):
    await knowledge_service.delete_document(user_id, doc_id)
    return ApiResponse.success()
