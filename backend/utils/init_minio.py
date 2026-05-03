from minio import Minio
from minio.error import S3Error

from config import settings


def init_minio_buckets():
    client = Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=False,
    )

    for bucket_name in [settings.MINIO_BUCKET_LORA, settings.MINIO_BUCKET_MODELS]:
        try:
            if not client.bucket_exists(bucket_name):
                client.make_bucket(bucket_name)
                print(f"Created bucket: {bucket_name}")
            else:
                print(f"Bucket already exists: {bucket_name}")
        except S3Error as e:
            print(f"Error creating bucket {bucket_name}: {e}")


if __name__ == "__main__":
    init_minio_buckets()
