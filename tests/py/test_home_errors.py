import os

from gameglance.home_errors import FILE_NAME, append_home_error


def test_appends_each_entry_and_creates_the_folder(tmp_path):
    folder = tmp_path / "logs" / "Game Glance"
    append_home_error(str(folder), "first entry")
    path = append_home_error(str(folder), "second entry\n")
    assert path == os.path.join(str(folder), FILE_NAME)
    with open(path, encoding="utf-8") as f:
        assert f.read() == "first entry\nsecond entry\n"


def test_keeps_the_newest_whole_entries_when_over_the_limit(tmp_path):
    folder = str(tmp_path)
    for i in range(40):
        path = append_home_error(folder, f"entry {i:03d} " + "x" * 10, max_bytes=300)
    assert os.path.getsize(path) <= 300
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    assert lines[-1] == "entry 039 " + "x" * 10
    assert all(line.startswith("entry ") for line in lines)
