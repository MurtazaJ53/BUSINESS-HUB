from django.utils.deprecation import MiddlewareMixin

class CSPMiddleware(MiddlewareMixin):
    """
    Adds Content-Security-Policy header to all responses.
    Restricts scripts to 'self' to mitigate XSS attacks.
    """
    def process_response(self, request, response):
        if "Content-Security-Policy" not in response:
            response["Content-Security-Policy"] = "default-src 'self'"
        return response
