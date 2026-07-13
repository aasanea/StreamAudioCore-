use cpal::traits::{DeviceTrait, HostTrait};
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use rubato::{SincInterpolationParameters, SincInterpolationType, Resampler, SincFixedIn, WindowFunction};
use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::sync::{Arc, Mutex};
use tauri::Manager;

use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::errors::Error;

#[derive(serde::Serialize, Clone, Debug)]
pub struct AudioDevice {
    pub name: String,
    pub id: String,
    pub is_sonar: bool,
}

pub struct CachedSound {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
}

// Wrapper to make rodio::OutputStream Send + Sync.
// We only hold the OutputStream to keep the stream alive; we never call any methods on it after creation.
#[allow(dead_code)]
pub struct SendOutputStream(pub OutputStream);
unsafe impl Send for SendOutputStream {}
unsafe impl Sync for SendOutputStream {}

pub struct AudioState {
    pub devices: Mutex<HashMap<String, (SendOutputStream, OutputStreamHandle)>>,
    pub active_sinks: Mutex<HashMap<String, Arc<Sink>>>,
    pub sample_cache: Mutex<HashMap<String, Arc<CachedSound>>>,
}

impl AudioState {
    pub fn new() -> Self {
        AudioState {
            devices: Mutex::new(HashMap::new()),
            active_sinks: Mutex::new(HashMap::new()),
            sample_cache: Mutex::new(HashMap::new()),
        }
    }

    pub fn get_device_handle(&self, device_name: Option<&str>) -> Result<OutputStreamHandle, String> {
        let mut devices = self.devices.lock().map_err(|e| e.to_string())?;
        let target_name = device_name.unwrap_or("default");

        if let Some((_, handle)) = devices.get(target_name) {
            return Ok(handle.clone());
        }

        let device = if target_name == "default" {
            cpal::default_host().default_output_device()
        } else {
            find_device_by_name(target_name)
        };

        let cpal_device = device.ok_or_else(|| format!("Audio device '{}' not found", target_name))?;
        let (stream, handle) = OutputStream::try_from_device(&cpal_device)
            .map_err(|e| format!("Failed to create output stream: {}", e))?;

        devices.insert(target_name.to_string(), (SendOutputStream(stream), handle.clone()));
        Ok(handle)
    }

    pub fn get_or_cache_sound(&self, file_path: &str) -> Result<Arc<CachedSound>, String> {
        let mut cache = self.sample_cache.lock().map_err(|e| e.to_string())?;
        if let Some(sound) = cache.get(file_path) {
            return Ok(sound.clone());
        }

        let sound = decode_audio_file(file_path)?;
        let arc_sound = Arc::new(sound);
        cache.insert(file_path.to_string(), arc_sound.clone());
        Ok(arc_sound)
    }
}

fn find_device_by_name(name: &str) -> Option<cpal::Device> {
    let host = cpal::default_host();
    if let Ok(output_devices) = host.output_devices() {
        for device in output_devices {
            if let Ok(dev_name) = device.name() {
                if dev_name == name {
                    return Some(device);
                }
            }
        }
    }
    None
}

fn decode_video_audio(path: &str) -> Result<CachedSound, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open video file {}: {}", path, e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(path).extension().and_then(|s| s.to_str()) {
        hint.with_extension(ext);
    }

    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();

    let mut probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| format!("Symphonia probe error for {}: {}", path, e))?;

    let format = &mut probed.format;

    // Find the first audio track
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL && t.codec_params.sample_rate.is_some())
        .ok_or_else(|| "No supported audio track found in the video file".to_string())?;

    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate.unwrap();
    let channels = track.codec_params.channels.map(|c| c.count() as u16).unwrap_or(2);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Failed to create symphonia decoder: {}", e))?;

    let mut samples: Vec<f32> = Vec::new();
    let mut sample_buf = None;

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(Error::IoError(ref err)) if err.kind() == std::io::ErrorKind::UnexpectedEof => {
                break;
            }
            Err(Error::ResetRequired) => {
                continue;
            }
            Err(_) => {
                break;
            }
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let spec = *decoded.spec();
                let duration = decoded.capacity() as u64;
                
                let buf = sample_buf.get_or_insert_with(|| {
                    SampleBuffer::<f32>::new(duration, spec)
                });
                
                buf.copy_interleaved_ref(decoded);
                samples.extend_from_slice(buf.samples());
            }
            Err(Error::DecodeError(err)) => {
                eprintln!("Decode error, skipping frame: {}", err);
            }
            Err(e) => {
                return Err(format!("Fatal decoding error: {}", e));
            }
        }
    }

    if samples.is_empty() {
        return Err("No audio samples decoded from video file".to_string());
    }

    Ok(CachedSound {
        samples,
        sample_rate,
        channels,
    })
}

fn decode_audio_file(path: &str) -> Result<CachedSound, String> {
    let lower_path = path.to_lowercase();
    if lower_path.ends_with(".mp4")
        || lower_path.ends_with(".webm")
        || lower_path.ends_with(".mkv")
        || lower_path.ends_with(".mov")
        || lower_path.ends_with(".avi")
    {
        return decode_video_audio(path);
    }

    let file = File::open(path).map_err(|e| format!("Failed to open audio file {}: {}", path, e))?;
    let reader = BufReader::new(file);
    
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let source = match Decoder::new(reader) {
            Ok(s) => s,
            Err(e) => return Err(format!("Failed to decode audio file: {}", e)),
        };

        let channels = source.channels();
        let sample_rate = source.sample_rate();
        let samples: Vec<f32> = source.convert_samples().collect();

        Ok(CachedSound {
            samples,
            sample_rate,
            channels,
        })
    }));

    match result {
        Ok(inner_res) => inner_res,
        Err(_) => Err("Audio decoding panicked. The media format may be unsupported by the backend decoder.".to_string()),
    }
}

pub fn resample_rubato(
    input: &[f32],
    speed: f32,
    channels: usize,
) -> Result<Vec<f32>, String> {
    if (speed - 1.0).abs() < 0.01 {
        return Ok(input.to_vec());
    }

    let ratio = 1.0 / speed as f64;
    let params = SincInterpolationParameters {
        sinc_len: 64,
        f_cutoff: 0.95,
        interpolation: SincInterpolationType::Linear,
        window: WindowFunction::BlackmanHarris2,
        oversampling_factor: 256,
    };
    let chunk_size = 1024;

    let mut resampler = SincFixedIn::<f32>::new(
        ratio,
        2.0,
        params,
        chunk_size,
        channels,
    ).map_err(|e| format!("Failed to create resampler: {:?}", e))?;

    // Deinterleave
    let mut deinterleaved = vec![vec![0.0f32; input.len() / channels]; channels];
    for (i, frame) in input.chunks_exact(channels).enumerate() {
        for ch in 0..channels {
            if i < deinterleaved[ch].len() {
                deinterleaved[ch][i] = frame[ch];
            }
        }
    }

    // Resize channels to multiple of chunk_size
    for ch in 0..channels {
        let rem = deinterleaved[ch].len() % chunk_size;
        if rem > 0 {
            let current_len = deinterleaved[ch].len();
            deinterleaved[ch].resize(current_len + chunk_size - rem, 0.0);
        }
    }

    let num_chunks = deinterleaved[0].len() / chunk_size;
    let mut output_channels = vec![Vec::new(); channels];

    for chunk_idx in 0..num_chunks {
        let mut chunk = vec![vec![0.0f32; chunk_size]; channels];
        for ch in 0..channels {
            chunk[ch].copy_from_slice(&deinterleaved[ch][chunk_idx * chunk_size..(chunk_idx + 1) * chunk_size]);
        }

        let processed = resampler.process(&chunk, None)
            .map_err(|e| format!("Resampling error: {:?}", e))?;

        for ch in 0..channels {
            output_channels[ch].extend_from_slice(&processed[ch]);
        }
    }

    // Interleave back
    let output_len = output_channels[0].len();
    let mut output = vec![0.0f32; output_len * channels];
    for i in 0..output_len {
        for ch in 0..channels {
            output[i * channels + ch] = output_channels[ch][i];
        }
    }

    Ok(output)
}

pub fn get_devices() -> Vec<AudioDevice> {
    let host = cpal::default_host();
    let mut devices = Vec::new();

    if let Ok(output_devices) = host.output_devices() {
        for device in output_devices {
            if let Ok(name) = device.name() {
                let is_sonar = name.to_lowercase().contains("sonar");
                devices.push(AudioDevice {
                    id: name.clone(),
                    name,
                    is_sonar,
                });
            }
        }
    }
    devices
}

fn apply_lowpass(samples: &mut [f32], channels: usize, alpha: f32) {
    let mut y_prev = vec![0.0f32; channels];
    for frame in samples.chunks_mut(channels) {
        for ch in 0..channels {
            let x = frame[ch];
            let y = alpha * x + (1.0 - alpha) * y_prev[ch];
            frame[ch] = y;
            y_prev[ch] = y;
        }
    }
}

fn apply_highpass(samples: &mut [f32], channels: usize, alpha: f32) {
    let mut x_prev = vec![0.0f32; channels];
    let mut y_prev = vec![0.0f32; channels];
    for frame in samples.chunks_mut(channels) {
        for ch in 0..channels {
            let x = frame[ch];
            let y = x - x_prev[ch] + alpha * y_prev[ch];
            frame[ch] = y;
            x_prev[ch] = x;
            y_prev[ch] = y;
        }
    }
}

fn apply_reverb(samples: &mut [f32], channels: usize, sample_rate: u32, feedback: f32, delay_sec: f32) {
    let delay_frames = (sample_rate as f32 * delay_sec) as usize;
    if delay_frames == 0 { return; }
    
    let delay_samples = delay_frames * channels;
    let mut delay_buffer = vec![0.0f32; delay_samples];
    let mut write_idx = 0;
    
    for i in 0..samples.len() {
        let x = samples[i];
        let delayed = delay_buffer[write_idx];
        
        let y = x + feedback * delayed;
        samples[i] = y;
        
        delay_buffer[write_idx] = y; // Feed back output
        write_idx = (write_idx + 1) % delay_samples;
    }
}

#[tauri::command]
pub fn get_output_devices() -> Result<Vec<AudioDevice>, String> {
    Ok(get_devices())
}

#[tauri::command]
pub fn check_device_availability(device_name: String) -> Result<bool, String> {
    Ok(find_device_by_name(&device_name).is_some())
}

#[tauri::command]
pub fn get_audio_peaks(file_path: String, num_points: u32, app_handle: tauri::AppHandle) -> Result<Vec<f32>, String> {
    let audio_state_wrapper = app_handle.state::<AudioState>();
    let audio_state = audio_state_wrapper.inner();

    let cached_sound = audio_state.get_or_cache_sound(&file_path)?;
    let samples = &cached_sound.samples;
    let channels = cached_sound.channels as usize;

    let total_frames = samples.len() / channels;
    if total_frames == 0 || num_points == 0 {
        return Ok(vec![0.0; num_points as usize]);
    }

    let chunk_size = total_frames / num_points as usize;
    let mut peaks = Vec::with_capacity(num_points as usize);

    for i in 0..num_points as usize {
        let start_frame = i * chunk_size;
        let end_frame = ((i + 1) * chunk_size).min(total_frames);

        let mut max_val = 0.0f32;
        for f in start_frame..end_frame {
            for ch in 0..channels {
                let idx = f * channels + ch;
                if idx < samples.len() {
                    let val = samples[idx].abs();
                    if val > max_val {
                        max_val = val;
                    }
                }
            }
        }
        peaks.push(max_val);
    }

    let mut absolute_max = 0.0f32;
    for &p in &peaks {
        if p > absolute_max {
            absolute_max = p;
        }
    }
    if absolute_max > 0.0 {
        for p in &mut peaks {
            *p /= absolute_max;
        }
    }

    Ok(peaks)
}

#[tauri::command]
pub fn play_sound_router(
    sound_id: String,
    device_name: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let config = {
        let state = app_handle.state::<Mutex<crate::config::Config>>();
        let guard = state.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    let sound_uuid = uuid::Uuid::parse_str(&sound_id).map_err(|e| format!("Invalid UUID: {}", e))?;
    let sound = config.sounds.iter().find(|s| s.id == sound_uuid)
        .ok_or_else(|| format!("Sound not found: {}", sound_id))?;

    let file_path = sound.file_path.clone();
    let volume = sound.volume;
    let device = device_name.or(sound.output_device.clone());

    let audio_state_wrapper = app_handle.state::<AudioState>();
    let audio_state = audio_state_wrapper.inner();
    
    let handle = match audio_state.get_device_handle(device.as_deref()) {
        Ok(h) => h,
        Err(err) => {
            eprintln!("Error getting device stream, falling back to default: {}", err);
            audio_state.get_device_handle(None)?
        }
    };

    let cached_sound = audio_state.get_or_cache_sound(&file_path)?;
    let sink = Sink::try_new(&handle).map_err(|e| format!("Failed to create sink: {}", e))?;
    sink.set_volume((volume as f32 / 100.0) * (config.global_volume as f32 / 100.0));

    let source = rodio::buffer::SamplesBuffer::new(
        cached_sound.channels,
        cached_sound.sample_rate,
        cached_sound.samples.clone(),
    );
    sink.append(source);

    let mut sinks = audio_state.active_sinks.lock().map_err(|e| e.to_string())?;
    sinks.insert(sound_id, Arc::new(sink));

    Ok(())
}

#[tauri::command]
pub fn stop_sound(sound_id: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let audio_state_wrapper = app_handle.state::<AudioState>();
    let audio_state = audio_state_wrapper.inner();
    
    let mut sinks = audio_state.active_sinks.lock().map_err(|e| e.to_string())?;
    if let Some(sink) = sinks.remove(&sound_id) {
        sink.stop();
    }
    Ok(())
}

#[tauri::command]
pub fn stop_all_sounds(app_handle: tauri::AppHandle) -> Result<(), String> {
    let audio_state_wrapper = app_handle.state::<AudioState>();
    let audio_state = audio_state_wrapper.inner();
    
    let mut sinks = audio_state.active_sinks.lock().map_err(|e| e.to_string())?;
    for sink in sinks.values() {
        sink.stop();
    }
    sinks.clear();
    Ok(())
}

#[tauri::command]
pub fn sampler_play(
    sound_id: String,
    cue_start_ms: u64,
    cue_end_ms: u64,
    speed: f32,
    mode: String,
    filter_mode: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let audio_state_wrapper = app_handle.state::<AudioState>();
    let audio_state = audio_state_wrapper.inner();

    let config = {
        let state = app_handle.state::<Mutex<crate::config::Config>>();
        let guard = state.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    let sound_uuid = uuid::Uuid::parse_str(&sound_id).map_err(|e| format!("Invalid UUID: {}", e))?;
    
    // Check if the pad is muted in configuration, if so, abort playback
    let is_muted = config.sampler_grid.pads.iter()
        .filter_map(|p| p.as_ref())
        .any(|pad| pad.sound_id == Some(sound_uuid) && pad.muted);
    if is_muted {
        return Ok(());
    }

    // Toggle mode: if playing, stop it
    if mode == "toggle" {
        let is_playing = {
            let sinks = audio_state.active_sinks.lock().map_err(|e| e.to_string())?;
            sinks.contains_key(&sound_id)
        };
        if is_playing {
            return stop_sound(sound_id, app_handle);
        }
    }

    // Solo mode: stop all other active pads
    let is_soloed = config.sampler_grid.pads.iter()
        .filter_map(|p| p.as_ref())
        .any(|pad| pad.sound_id == Some(sound_uuid) && pad.soloed);
    if is_soloed || mode == "solo" {
        let other_pad_ids: Vec<String> = config.sampler_grid.pads.iter()
            .filter_map(|p| p.as_ref().and_then(|pad| pad.sound_id.map(|id| id.to_string())))
            .filter(|id| id != &sound_id)
            .collect();
        for other_id in other_pad_ids {
            let _ = stop_sound(other_id, app_handle.clone());
        }
    }

    let sound = config.sounds.iter().find(|s| s.id == sound_uuid)
        .ok_or_else(|| format!("Sound not found: {}", sound_id))?;

    let file_path = sound.file_path.clone();
    let volume = sound.volume;
    let device = sound.output_device.clone();

    let handle = match audio_state.get_device_handle(device.as_deref()) {
        Ok(h) => h,
        Err(err) => {
            eprintln!("Error getting device stream, falling back to default: {}", err);
            audio_state.get_device_handle(None)?
        }
    };

    let cached_sound = audio_state.get_or_cache_sound(&file_path)?;
    let channels = cached_sound.channels as usize;
    let sample_rate = cached_sound.sample_rate;
    let total_samples = cached_sound.samples.len();

    let start_idx = ((cue_start_ms as f64 * sample_rate as f64 / 1000.0) as usize * channels).min(total_samples);
    let end_idx = if cue_end_ms == 0 {
        total_samples
    } else {
        ((cue_end_ms as f64 * sample_rate as f64 / 1000.0) as usize * channels).min(total_samples)
    };

    if start_idx >= end_idx {
        return Err("Invalid cue points: start is greater or equal to end".to_string());
    }

    let sliced = &cached_sound.samples[start_idx..end_idx];
    let mut resampled = resample_rubato(sliced, speed, channels)?;

    // Apply real-time DSP filter
    match filter_mode.as_str() {
        "lowpass" => apply_lowpass(&mut resampled, channels, 0.1),
        "highpass" => apply_highpass(&mut resampled, channels, 0.9),
        "reverb" => apply_reverb(&mut resampled, channels, sample_rate, 0.4, 0.08),
        _ => {}
    }

    let sink = Sink::try_new(&handle).map_err(|e| format!("Failed to create sink: {}", e))?;
    sink.set_volume((volume as f32 / 100.0) * (config.global_volume as f32 / 100.0));

    if mode == "loop" {
        let source = rodio::buffer::SamplesBuffer::new(
            cached_sound.channels,
            cached_sound.sample_rate,
            resampled,
        ).repeat_infinite();
        sink.append(source);
    } else {
        let source = rodio::buffer::SamplesBuffer::new(
            cached_sound.channels,
            cached_sound.sample_rate,
            resampled,
        );
        sink.append(source);
    }

    let mut sinks = audio_state.active_sinks.lock().map_err(|e| e.to_string())?;
    sinks.insert(sound_id, Arc::new(sink));

    Ok(())
}

#[tauri::command]
pub fn get_playing_states(app_handle: tauri::AppHandle) -> Result<HashMap<String, bool>, String> {
    let audio_state_wrapper = app_handle.state::<AudioState>();
    let audio_state = audio_state_wrapper.inner();
    
    let mut sinks = audio_state.active_sinks.lock().map_err(|e| e.to_string())?;
    
    // Retain only those sinks that are still active (not empty)
    sinks.retain(|_, sink| !sink.empty());

    let mut states = HashMap::new();
    for id in sinks.keys() {
        states.insert(id.clone(), true);
    }
    Ok(states)
}

#[tauri::command]
pub fn select_audio_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("Media Files", &["mp3", "wav", "ogg", "flac", "m4a", "mp4", "webm", "mkv", "mov", "avi"])
        .pick_file();
        
    file.map(|p| p.to_string_lossy().into_owned())
}
#[tauri::command]
pub fn select_image_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("Image Files", &["png", "jpg", "jpeg", "webp", "gif"])
        .pick_file();
        
    file.map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn select_pack_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("StreamAudio Pack", &["sa-pack"])
        .pick_file();
        
    file.map(|p| p.to_string_lossy().into_owned())
}
