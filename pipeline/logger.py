"""
Pipeline logger — writes timestamped logs to output/pipeline.log.
Every Claude call, every stage transition, every error is recorded.
"""
import logging
import os
import sys

LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "output", "pipeline.log")


def setup(level=logging.DEBUG) -> logging.Logger:
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)

    logger = logging.getLogger("adamax")
    logger.setLevel(level)

    if logger.handlers:
        return logger

    fmt = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # File handler — full debug log
    fh = logging.FileHandler(LOG_PATH, mode="a", encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)

    # Console handler — INFO and above only
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)

    logger.addHandler(fh)
    logger.addHandler(ch)

    return logger


def get() -> logging.Logger:
    return logging.getLogger("adamax")
