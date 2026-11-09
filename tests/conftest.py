import gc

import pytest


@pytest.fixture(autouse=True)
def collect():
    """pytexl's objects must be freed on the thread that made them: free them
    after each test, not during a later test that runs a server on another
    thread (where pytexl warns that they are dropped on the wrong thread)."""
    yield
    gc.collect()
