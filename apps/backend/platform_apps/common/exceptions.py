import logging
import uuid

from rest_framework.views import exception_handler
from rest_framework.response import Response

logger = logging.getLogger(__name__)

def core_exception_handler(exc, context):
    """
    Custom exception handler for DRF that catches unhandled exceptions (500s),
    logs the full traceback securely on the server with a correlation ID, and
    returns only a generic error message + correlation ID to the client to 
    prevent leaking stack traces or internal server details.
    """
    response = exception_handler(exc, context)

    if response is None:
        # Unhandled exception (Server Error 500)
        correlation_id = str(uuid.uuid4())
        logger.error(
            f"Unhandled exception [ID: {correlation_id}]: {exc}", 
            exc_info=True,
            extra={
                "correlation_id": correlation_id,
                "request_path": context["request"].path if context and "request" in context else None,
            }
        )
        return Response(
            {
                "detail": "An internal server error occurred.",
                "correlation_id": correlation_id
            },
            status=500
        )
    return response
