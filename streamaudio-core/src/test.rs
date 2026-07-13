use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct DependencyInfo {
    pub version: String,
    pub url: String,
    pub sha256: String,
    pub minimum_app_version: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RemoteManifest {
    pub dependencies: std::collections::HashMap<String, DependencyInfo>,
}

#[tokio::main]
async fn main() {
    let url = "https://updates.aasanea.com/dependencies/manifest.json";
    let resp = reqwest::get(url).await.unwrap();
    let manifest: RemoteManifest = resp.json().await.unwrap();
    println!("{:?}", manifest);
}
