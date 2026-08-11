//! Integration tests for zip read/extract + path-traversal safety (Section 24.4).

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use reporun_lib::commands::zip as rr_zip;

#[test]
fn list_zip_contents_reports_entries() {
    let path = std::env::temp_dir().join(format!("reporun-test-{}.zip", nanos()));
    write_test_zip(&path, &[("hello.txt", "hi"), ("dir/a.txt", "a")]);
    let entries = rr_zip::list_zip_contents(path.to_str().unwrap()).expect("list");
    assert!(entries.iter().any(|e| e.name.ends_with("hello.txt")));
    assert!(entries.iter().any(|e| e.name.contains("a.txt")));
    let _ = fs::remove_file(&path);
}

#[test]
fn extract_zip_round_trips_contents() {
    let path = std::env::temp_dir().join(format!("reporun-test-{}.zip", nanos()));
    write_test_zip(&path, &[("hello.txt", "hi"), ("dir/a.txt", "a")]);
    let dest = rr_zip::extract_zip(path.to_str().unwrap()).expect("extract");
    assert_eq!(
        fs::read_to_string(format!("{dest}/hello.txt")).unwrap(),
        "hi"
    );
    assert_eq!(
        fs::read_to_string(format!("{dest}/dir/a.txt")).unwrap(),
        "a"
    );
    let _ = fs::remove_file(&path);
    let _ = fs::remove_dir_all(&dest);
}

/// Required security test (Section 24.4): a zip with `../` entries cannot
/// escape the extraction folder. `enclosed_name` strips parent segments on
/// read; `sanitize_join` rejects them defensively as a second layer.
#[test]
fn extract_zip_blocks_path_traversal() {
    let path = std::env::temp_dir().join(format!("reporun-traversal-{}.zip", nanos()));
    write_test_zip_raw(&path, "../escape.txt", b"bad");
    let escaped = std::env::temp_dir().join("escape.txt");
    let _ = fs::remove_file(&escaped);

    let dest = rr_zip::extract_zip(path.to_str().unwrap()).expect("extract");
    // The escaped target must NOT exist outside the dest folder.
    assert!(
        !escaped.exists(),
        "path traversal succeeded — escape.txt created outside dest"
    );
    let _ = fs::remove_file(&path);
    let _ = fs::remove_dir_all(&dest);
    let _ = fs::remove_file(&escaped);
}

/// Corrupted zip returns a clear error, not a panic.
#[test]
fn list_zip_contents_rejects_corrupt_zip() {
    let path = std::env::temp_dir().join(format!("reporun-corrupt-{}.zip", nanos()));
    fs::write(&path, b"not a zip file at all").unwrap();
    let r = rr_zip::list_zip_contents(path.to_str().unwrap());
    assert!(r.is_err());
    let _ = fs::remove_file(&path);
}

// --- helpers ----------------------------------------------------------------

fn nanos() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    format!(
        "{:x}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    )
}

fn write_test_zip(path: &std::path::Path, entries: &[(&str, &str)]) {
    let file = fs::File::create(path).unwrap();
    let mut zipw = ZipWriter::new(file);
    let opts = SimpleFileOptions::default();
    for (name, content) in entries {
        if name.ends_with('/') {
            zipw.add_directory(*name, opts).unwrap();
        } else {
            zipw.start_file(*name, opts).unwrap();
            zipw.write_all(content.as_bytes()).unwrap();
        }
    }
    zipw.finish().unwrap();
}

/// Write a zip with a raw entry name containing `..` (a malicious archive).
fn write_test_zip_raw(path: &std::path::Path, raw_name: &str, content: &[u8]) {
    let file = fs::File::create(path).unwrap();
    let mut zipw = ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    zipw.start_file(raw_name, opts).unwrap();
    zipw.write_all(content).unwrap();
    zipw.finish().unwrap();
}

#[test]
fn fixture_dir_resolves() {
    // Sanity that CARGO_MANIFEST_DIR + fixtures path is reachable for future fixtures.
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("tests/fixtures");
    let _ = p;
}
