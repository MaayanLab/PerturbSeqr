import os
import json
import dotenv
from urllib.parse import urlparse
from minio import Minio

dotenv.load_dotenv()

# Parse S3_URL: http://user:pass@host:port/bucket
S3_URL = os.environ.get('S3_URL', 'http://minio:minioadmin@localhost:9000/gmts')
PUBLIC_S3_URL = os.environ.get('PUBLIC_S3_URL', 'http://localhost:9000/gmts')

parsed = urlparse(S3_URL)
bucket = parsed.path.lstrip('/')

print(f"Connecting to MinIO at {parsed.hostname}:{parsed.port}")
s3 = Minio(
    f"{parsed.hostname}:{parsed.port}",
    access_key=parsed.username,
    secret_key=parsed.password,
    secure=parsed.scheme == 'https',
)

# Create bucket if it doesn't exist
if not s3.bucket_exists(bucket):
    print(f"Creating bucket: {bucket}")
    s3.make_bucket(bucket)
else:
    print(f"Bucket exists: {bucket}")

# Set public download policy
print(f"Setting public download policy on {bucket}")
policy = {
    'Version': '2012-10-17',
    'Statement': [
        {
            'Effect': 'Allow',
            'Principal': {'AWS': '*'},
            'Action': 's3:GetBucketLocation',
            'Resource': f"arn:aws:s3:::{bucket}"
        },
        {
            'Effect': 'Allow',
            'Principal': {'AWS': '*'},
            'Action': 's3:GetObject',
            'Resource': f"arn:aws:s3:::{bucket}/*"
        },
    ],
}
s3.set_bucket_policy(bucket, json.dumps(policy))

print(f"Done! Files available at {PUBLIC_S3_URL}/")
