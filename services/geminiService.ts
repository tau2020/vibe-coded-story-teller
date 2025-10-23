
import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToGenerativePart = (base64Data: string, mimeType: string) => {
    return {
      inlineData: {
        data: base64Data.split(',')[1],
        mimeType
      },
    };
};

export const generateStoryFromImage = async (base64Image: string, mimeType: string): Promise<string> => {
    const imagePart = fileToGenerativePart(base64Image, mimeType);
    const textPart = {
        text: "Analyze the mood and scene of this image. Ghostwrite an intriguing and evocative opening paragraph to a story set in this world. The tone should be creative and literary."
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] }
        });
        
        return response.text.trim();
    } catch (error) {
        console.error("Error generating story from image:", error);
        throw new Error("Failed to communicate with the Gemini API for story generation.");
    }
};

export const generateSpeechFromText = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Read this with an expressive, narrative voice: ${text}` }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' }, // An expressive voice
                  },
              },
            },
        });
        
        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) {
            throw new Error("No audio data received from API.");
        }
        return audioData;
    } catch (error) {
        console.error("Error generating speech from text:", error);
        throw new Error("Failed to communicate with the Gemini API for speech generation.");
    }
};
