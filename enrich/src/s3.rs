use s3::{Bucket, Region, creds::Credentials};

pub fn create_bucket() -> Box<Bucket> {
    let endpoint = std::env::var("MINIO_ENDPOINT").expect("MINIO_ENDPOINT must be set");
    let secure = std::env::var("MINIO_SECURE").unwrap_or_else(|_| "false".into()) == "true";
    let region = Region::Custom {
        region: "us-east-1".into(),
        endpoint: format!("{}://{}", if secure { "https" } else { "http" }, endpoint),
    };
    let credentials = Credentials::new(
        Some(&std::env::var("MINIO_ROOT_USER").expect("MINIO_ROOT_USER must be set")),
        Some(&std::env::var("MINIO_ROOT_PASSWORD").expect("MINIO_ROOT_PASSWORD must be set")),
        None, None, None,
    ).expect("invalid S3 credentials");
    Bucket::new("data", region, credentials).expect("invalid S3 bucket").with_path_style()
}

fn index_key(id: &uuid::Uuid) -> String {
    format!("enrich/index_{}.bin", id)
}

pub async fn put_index(bucket: &Bucket, id: &uuid::Uuid, bytes: &[u8]) -> Result<(), String> {
    bucket.put_object(&index_key(id), bytes).await.map_err(|e| e.to_string())?;
    println!("[{}] saved index to S3 ({:.1} MB)", id, bytes.len() as f64 / 1_048_576.0);
    Ok(())
}

pub async fn get_index(bucket: &Bucket, id: &uuid::Uuid) -> Result<Vec<u8>, String> {
    let resp = bucket.get_object(&index_key(id)).await.map_err(|e| e.to_string())?;
    println!("[{}] loaded index from S3", id);
    Ok(resp.into())
}

pub async fn delete_index(bucket: &Bucket, id: &uuid::Uuid) -> Result<(), String> {
    bucket.delete_object(&index_key(id)).await.map_err(|e| e.to_string())?;
    println!("[{}] deleted index from S3", id);
    Ok(())
}
