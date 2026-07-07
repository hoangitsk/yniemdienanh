import os
import ftplib
import sys

# FTP Configuration
FTP_HOST = "ftpupload.net"
FTP_USER = "if0_42342185"
FTP_PASS = "GB9eMqPMra3MCO1"
FTP_PORT = 21
REMOTE_ROOT = "/yniemdienanh.gt.tc/htdocs"

# Define what to upload
# Files relative to the project root
UPLOAD_FILES = [
    "index.html",
    "manifest.json",
    "sw.js",
    "robots.txt",
    "sitemap.xml",
    "privacy.html",
    "terms.html",
    "favicon.ico",
]

# Directories relative to the project root
UPLOAD_DIRS = [
    "Logo",
    "api",
]

def make_dirs(ftp, path):
    """Create directory path on FTP recursively if it doesn't exist."""
    parts = [p for p in path.split('/') if p]
    current = ""
    for part in parts:
        current += "/" + part
        try:
            ftp.cwd(current)
        except ftplib.error_perm:
            print(f"  -> Creating remote folder: {current}")
            ftp.mkd(current)

def upload_file(ftp, local_path, remote_path):
    """Upload a file to the FTP server, ensuring directories exist."""
    # Normalize path separators for FTP (always forward slashes)
    remote_path = remote_path.replace("\\", "/")
    
    # Ensure remote directory exists
    remote_dir = os.path.dirname(remote_path)
    if remote_dir:
        make_dirs(ftp, remote_dir)
        
    print(f"Uploading: {local_path} -> {remote_path} ... ", end="", flush=True)
    try:
        with open(local_path, 'rb') as f:
            ftp.storbinary(f'STOR {remote_path}', f)
        print("SUCCESS")
    except Exception as e:
        print(f"FAILED\nError: {e}")

def main():
    print("==================================================")
    print("      FTP DEPLOYER FOR INFINITYFREE SERVER")
    print("==================================================")
    
    # Change working directory to the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    try:
        print(f"Connecting to {FTP_HOST}:{FTP_PORT}...")
        ftp = ftplib.FTP()
        ftp.connect(FTP_HOST, FTP_PORT, timeout=30)
        
        print(f"Logging in as '{FTP_USER}'...")
        ftp.login(FTP_USER, FTP_PASS)
        
        # Set passive mode (CRITICAL for NAT/Firewall environments)
        ftp.set_pasv(True)
        print("Login successful. Passive mode enabled.")
        
        # Go to the root htdocs folder of the domain
        print(f"Navigating to remote root: {REMOTE_ROOT}")
        try:
            ftp.cwd(REMOTE_ROOT)
        except ftplib.error_perm:
            print(f"Remote root {REMOTE_ROOT} not found. Creating it...")
            make_dirs(ftp, REMOTE_ROOT)
            ftp.cwd(REMOTE_ROOT)
            
        print("\n--- Starting Upload ---")
        
        # 1. Upload individual files
        for filename in UPLOAD_FILES:
            if os.path.exists(filename):
                upload_file(ftp, filename, filename)
            else:
                print(f"Warning: Local file not found: {filename}")
                
        # 2. Upload directories recursively
        for dirname in UPLOAD_DIRS:
            if os.path.exists(dirname) and os.path.isdir(dirname):
                for root, dirs, files in os.walk(dirname):
                    for file in files:
                        local_path = os.path.join(root, file)
                        # Relative path from project root
                        rel_path = os.path.relpath(local_path, ".")
                        upload_file(ftp, local_path, rel_path)
            else:
                print(f"Warning: Local directory not found: {dirname}")
                
        ftp.quit()
        print("\n==================================================")
        print("  Deploy successful to InfinityFree!")
        print("  URL: http://yniemdienanh.gt.tc")
        print("==================================================")
        
    except Exception as e:
        print(f"\n[ERROR] Deployment failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
