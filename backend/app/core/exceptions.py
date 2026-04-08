"""异常定义"""


class QuizGenerationError(Exception):
    """题库生成失败"""

    def __init__(self, message: str = "题库生成失败，请稍后重试"):
        self.message = message
        super().__init__(self.message)


class ReportGenerationError(Exception):
    """报告生成失败"""

    def __init__(self, message: str = "报告生成失败，请稍后重试"):
        self.message = message
        super().__init__(self.message)


class ContentFilterError(Exception):
    """内容过滤异常"""

    def __init__(self, message: str = "输入内容包含敏感词，请修改后重试"):
        self.message = message
        super().__init__(self.message)


class AuthenticationError(Exception):
    """鉴权失败"""

    def __init__(self, message: str = "未登录或登录已过期"):
        self.message = message
        super().__init__(self.message)
