import type { CameraVideoOutput, VideoOutputOptions } from '../specs/outputs/CameraVideoOutput.nitro';
/**
 * Use a {@linkcode CameraVideoOutput} for recording videos.
 *
 * The returned {@linkcode CameraVideoOutput} can be passed to a
 * {@linkcode Camera} to enable video recording. To actually record a video,
 * create a {@linkcode Recorder} via
 * {@linkcode CameraVideoOutput.createRecorder | createRecorder(...)}, then
 * start and stop it via {@linkcode Recorder.startRecording | startRecording(...)}
 * and {@linkcode Recorder.stopRecording | stopRecording()}.
 *
 * @example
 * ```ts
 * const videoOutput = useVideoOutput({
 *   targetResolution: CommonResolutions.FHD_16_9,
 *   enableAudio: true,
 * })
 *
 * // ...
 * const recorder = await videoOutput.createRecorder({})
 * await recorder.startRecording(
 *   (filePath) => console.log(`Recorded to ${filePath}`),
 *   (error) => console.error(error),
 * )
 * // later...
 * await recorder.stopRecording()
 * ```
 */
export declare function useVideoOutput({ targetResolution, targetBitRate, enablePersistentRecorder, enableAudio, fileType, }?: Partial<VideoOutputOptions>): CameraVideoOutput;
