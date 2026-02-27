import os

APP_ENV_LOCAL = "LOCAL"
APP_ENV_DEV = "DEV"
APP_ENV_STABLE = "STABLE"
APP_ENV_PREPUB = "PREPUB"
APP_ENV_GRAY = "GRAY"
APP_ENV_PROD = "PROD"
APP_ENV_TEST = "TEST"


def env_settings():
    """如果环境变量里面没有DJANGO_SETTINGS_MODULE，那么根据应用所在环境设置默认值"""
    if "DJANGO_SETTINGS_MODULE" in os.environ:
        return
    current_app_env = os.environ.get("SERVER_ENV", APP_ENV_LOCAL).upper()
    if current_app_env in (APP_ENV_LOCAL,):
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "coevoloop.settings.local")
    elif current_app_env in (APP_ENV_DEV, APP_ENV_STABLE,):
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "coevoloop.settings.dev")
    elif current_app_env in (APP_ENV_TEST,):
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "coevoloop.settings.test")
    elif current_app_env in (APP_ENV_PREPUB, APP_ENV_GRAY, APP_ENV_PROD):
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "coevoloop.settings.prod")
    else:
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "coevoloop.settings.local")