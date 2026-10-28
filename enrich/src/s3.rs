use s3::{Bucket, Region, creds::Credentials};
use std::env;

pub fn create_bucket() -> Box<Bucket> {
    let endpoint = env::var("ENRICH_S3_ENDPOINT").ok().filter(|value| !value.is_empty());
    let configured_s3 = endpoint.is_some();
    assert!(configured_s3 || env::var("ENRICH_S3_BUCKET").unwrap_or_default().is_empty(),
        "ENRICH_S3_ENDPOINT must be set with ENRICH_S3_BUCKET");
    let endpoint = endpoint.unwrap_or_else(|| {
        let host = env::var("MINIO_ENDPOINT").expect("MINIO_ENDPOINT must be set");
        let secure = env::var("MINIO_SECURE").unwrap_or_else(|_| "false".into()) == "true";
        format!("{}://{}", if secure { "https" } else { "http" }, host)
    });
    assert!(endpoint.starts_with("https://") || endpoint.starts_with("http://"),
        "ENRICH_S3_ENDPOINT must include http:// or https://");
    let bucket = if configured_s3 {
        env::var("ENRICH_S3_BUCKET").expect("ENRICH_S3_BUCKET must be set")
    } else {
        "data".into()
    };
    assert!(!bucket.is_empty(), "ENRICH_S3_BUCKET must not be empty");
    let region = Region::Custom {
        region: if configured_s3 {
            env::var("AWS_REGION").unwrap_or_else(|_| "us-east-1".into())
        } else {
            "us-east-1".into()
        },
        endpoint: endpoint.trim_end_matches('/').into(),
    };
    let credentials = if configured_s3 {
        Credentials::from_env().expect("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set")
    } else {
        Credentials::new(
            Some(&env::var("MINIO_ROOT_USER").expect("MINIO_ROOT_USER must be set")),
            Some(&env::var("MINIO_ROOT_PASSWORD").expect("MINIO_ROOT_PASSWORD must be set")),
            None, None, None,
        ).expect("invalid S3 credentials")
    };
    Bucket::new(&bucket, region, credentials).expect("invalid S3 bucket").with_path_style()
}

fn index_key(id: &uuid::Uuid) -> String {
    let prefix = env::var("ENRICH_S3_PREFIX").unwrap_or_else(|_| "enrich/".into());
    let prefix = prefix.trim_matches('/');
    assert!(!prefix.is_empty(), "ENRICH_S3_PREFIX must not be empty");
    format!("{}/index_v2_{}.bin", prefix, id)
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
