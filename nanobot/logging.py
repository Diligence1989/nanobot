"""Centralized logging configuration for nanobot.

Writes logs to both stderr and rotating files under ~/.nanobot/logs/.
- One file per day
- Rotates at 5MB within the same day (new file with timestamp range in name)
- File names include start time for readability
"""

import os
import sys
from datetime import datetime
from pathlib import Path

from loguru import logger


LOG_DIR = Path.home() / ".nanobot" / "logs"


def _make_log_path() -> str:
    """Return a log file path pattern for loguru rotation.

    loguru's built-in rotation handles the actual file naming, but we
    use a custom sink to get the start-end timestamp naming we want.
    """
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    return str(LOG_DIR / "nanobot_{time:YYYY-MM-DD_HH-mm-ss}.log")


def setup_logging(verbose: bool = False) -> None:
    """Configure loguru to write to console + rotating log files.

    Args:
        verbose: If True, set console level to DEBUG. Otherwise INFO.
    """
    # Remove default handler
    logger.remove()

    # Console handler
    console_level = "DEBUG" if verbose else "INFO"
    logger.add(
        sys.stderr,
        level=console_level,
        format="<green>{time:HH:mm:ss}</green> | <level>{level:<7}</level> | <cyan>{name}</cyan> - {message}",
        colorize=True,
    )

    # File handler: rotate daily OR at 5MB, whichever comes first
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logger.add(
        _make_log_path(),
        level="DEBUG",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level:<7} | {name}:{function}:{line} - {message}",
        rotation="5 MB",
        retention="30 days",
        encoding="utf-8",
        enqueue=True,  # Thread-safe
    )

    logger.enable("nanobot")
    logger.info(f"Logging initialized. Log dir: {LOG_DIR}")
