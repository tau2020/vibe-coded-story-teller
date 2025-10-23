
import React, { useState, useRef, useCallback } from 'react';
import { generateStoryFromImage, generateSpeechFromText } from './services/geminiService';
import { decode, decodeAudioData } from './utils/audioUtils';
import { UploadIcon, PlayIcon, StopIcon, SparklesIcon } from './components/Icons';

type AppState = 'idle' | 'loadingStory' | 'loadingAudio' | 'error';

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [story, setStory] = useState<string>('');
  const [status, setStatus] = useState<AppState>('idle');
  const [error, setError] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file.');
        setStatus('error');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target?.result as string;
        setImage(base64Image);
        setStory('');
        setError('');
        setStatus('loadingStory');
        
        try {
          const generatedStory = await generateStoryFromImage(base64Image, file.type);
          setStory(generatedStory);
          setStatus('idle');
        } catch (err) {
          console.error(err);
          setError('Failed to generate story. Please try again.');
          setStatus('error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const stopPlayback = useCallback(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const handleTogglePlayback = useCallback(async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (!story) return;

    setStatus('loadingAudio');
    setError('');

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      // Resume context if it's suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const base64Audio = await generateSpeechFromText(story);
      const audioBytes = decode(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current, 24000, 1);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setIsPlaying(false);
        audioSourceRef.current = null;
      };

      source.start();
      audioSourceRef.current = source;
      setIsPlaying(true);
      setStatus('idle');

    } catch (err) {
      console.error(err);
      setError('Failed to generate audio. Please try again.');
      setStatus('error');
      setIsPlaying(false);
    }
  }, [isPlaying, story, stopPlayback]);

  const isLoading = status === 'loadingStory' || status === 'loadingAudio';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
          AI Story Starter
        </h1>
        <p className="mt-2 text-gray-400 max-w-2xl">
          Upload an image. Let AI ghostwrite an opening paragraph. Then, hear your story come to life.
        </p>
      </header>
      
      <main className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 flex flex-col items-center justify-center space-y-4">
          <div className="w-full h-80 bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-600">
            {image ? (
              <img src={image} alt="Story inspiration" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-gray-500">
                <UploadIcon className="mx-auto h-12 w-12" />
                <p>Your image will appear here</p>
              </div>
            )}
          </div>
          <label htmlFor="image-upload" className="cursor-pointer w-full text-center bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-indigo-500 transition-colors duration-300 flex items-center justify-center space-x-2">
            <UploadIcon className="h-5 w-5" />
            <span>{image ? 'Choose Another Image' : 'Upload an Image'}</span>
          </label>
          <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={isLoading} />
        </div>

        <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 flex flex-col">
          <div className="flex-grow min-h-[20rem] relative">
            {status === 'loadingStory' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/50 rounded-lg">
                <SparklesIcon className="h-10 w-10 animate-pulse text-purple-400" />
                <p className="mt-2 text-lg">Crafting your story...</p>
              </div>
            ) : story ? (
              <div className="h-full overflow-y-auto pr-2">
                <p className="text-lg leading-relaxed whitespace-pre-wrap font-serif text-gray-300">{story}</p>
              </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
                    <SparklesIcon className="h-12 w-12" />
                    <p>Your generated story will appear here</p>
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-700">
            {error && <p className="text-red-400 text-center mb-4">{error}</p>}
            <button 
              onClick={handleTogglePlayback}
              disabled={!story || status === 'loadingStory'}
              className="w-full text-center bg-cyan-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 disabled:bg-gray-600 disabled:cursor-not-allowed hover:enabled:bg-cyan-500"
            >
              {status === 'loadingAudio' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating Audio...</span>
                </>
              ) : isPlaying ? (
                <>
                  <StopIcon className="h-5 w-5" />
                  <span>Stop Reading</span>
                </>
              ) : (
                <>
                  <PlayIcon className="h-5 w-5" />
                  <span>Read Aloud</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
