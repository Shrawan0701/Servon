import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { ADVISOR_API_BASE_URL, askAdvisorByVoice } from '../api';
import { useVoicePlaybackController } from '../hooks/useVoicePlaybackController';

const QUESTIONS = [
  'How much revenue today?', 'How much profit today?', 'Why are sales low?',
  'Which item sold most?', 'What should I promote today?', 'Compare this week with last week.',
  'How many customers visited?', 'What should I buy tomorrow?', 'Should I increase prices?',
];

const LANGUAGE_STORAGE_KEY = 'voice_advisor_language';
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
];

const STATUS = {
  idle: { label: '🎤 Hold to Talk' },
  listening: { label: '🎙 Listening...' },
  thinking: { label: '🤖 Thinking...' },
  speaking: { label: '🔊 Speaking...' },
};

export default function VoiceAdvisorTab({ onConversationSaved }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const playback = useVoicePlaybackController();
  const [state, setState] = useState('idle');
  const [language, setLanguage] = useState('en');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const wave = useRef(new Animated.Value(0.35)).current;
  const autoStopTimer = useRef(null);
  const recordingRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((savedLanguage) => {
        if (LANGUAGES.some((item) => item.code === savedLanguage)) setLanguage(savedLanguage);
      })
      .catch((storageError) => console.warn('Unable to restore Voice Advisor language:', storageError));
  }, []);

  const selectLanguage = async (nextLanguage) => {
    if (state !== 'idle') return;
    setLanguage(nextLanguage);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch (storageError) {
      console.warn('Unable to save Voice Advisor language:', storageError);
    }
  };

  useEffect(() => {
    if (state !== 'listening' && state !== 'speaking') {
      wave.stopAnimation();
      wave.setValue(0.35);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(wave, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(wave, { toValue: 0.35, duration: 450, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [state, wave]);

  useEffect(() => () => clearTimeout(autoStopTimer.current), []);

  useEffect(() => {
    if (state === 'speaking' && !playback.isPlaying) setState('idle');
  }, [state, playback.isPlaying]);

  const submitRecording = async (uri, recorderState) => {
    console.log('[VoiceAdvisor] recorderState.url:', recorderState?.url);
    console.log('[VoiceAdvisor] uri:', uri);

    if (!recorderState?.url || !uri) {
      setState('idle');
      setError('No audio was captured. The recording URL is unavailable, so the request was not sent.');
      return;
    }
    setState('thinking');
    setError('');
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(uri)).blob();
        formData.append('audio', blob, 'voice-question.webm');
      } else {
        formData.append('audio', { uri, name: 'voice-question.m4a', type: 'audio/m4a' });
      }
      formData.append('language', language);

      const formDataContents = typeof formData.entries === 'function'
        ? Array.from(formData.entries()).map(([key, value]) => [key, value instanceof Blob ? { type: value.type, size: value.size } : value])
        : formData._parts;
      console.log('[VoiceAdvisor] FormData contents:', formDataContents);
      console.log('[VoiceAdvisor] Request URL:', `${ADVISOR_API_BASE_URL}/advisor/voice`);

      const response = await askAdvisorByVoice(formData);
      setResult(response.data);
      onConversationSaved?.();
      if (response.data.audio) {
        setState('speaking');
        playback.play(response.data.audio);
      } else {
        setState('idle');
      }
    } catch (requestError) {
      console.error("========== AXIOS ERROR ==========");
console.log("Code:", requestError.code);
console.log("Message:", requestError.message);
console.log("Status:", requestError.response?.status);
console.log("Response:", requestError.response?.data);
console.log("Request:", requestError.request);
console.log("Config:", requestError.config);
console.error(requestError);
      setError(requestError.response?.data?.error || 'Voice request failed. Please try again.');
      setState('idle');
    }
  };

 const startRecording = async () => {
  if (state !== 'idle') return;

  try {
    const permission = await requestRecordingPermissionsAsync();

    if (!permission.granted) {
      setError('Microphone permission is required to use Voice Advisor.');
      return;
    }

    setError('');
    setResult(null);

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    await recorder.prepareToRecordAsync();

    // IMPORTANT
    await recorder.record();

    // Give Expo a moment to enter recording state
    await new Promise(resolve => setTimeout(resolve, 150));

    const status = recorder.getStatus();

    if (!status.isRecording) {
      throw new Error('Recorder failed to start.');
    }

    recordingRef.current = true;

    setState('listening');

    autoStopTimer.current = setTimeout(stopRecording, 45000);

  } catch (recordingError) {
    console.error('Unable to start recording:', recordingError);

    recordingRef.current = false;

    setState('idle');

    setError('Could not start the microphone. Please try again.');
  }
};

 const stopRecording = async () => {
  if (!recordingRef.current) return;

  clearTimeout(autoStopTimer.current);

  try {
    const status = recorder.getStatus();

    if (!status.isRecording) {
      recordingRef.current = false;
      setState('idle');
      return;
    }

    await recorder.stop();

    recordingRef.current = false;

    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    const recorderState = recorder.getStatus();

    const uri = recorderState.url;

    await submitRecording(uri, recorderState);

  } catch (recordingError) {
    console.error('Unable to stop recording:', recordingError);

    recordingRef.current = false;

    setState('idle');

    setError('Could not finish the recording. Please try again.');
  }
};

  const askSuggestion = async (question) => {
    // Voice mode deliberately keeps text suggestions as prompts to speak, rather than bypassing the voice flow.
    setResult({ transcript: question, answer: 'Hold the microphone and say this question to receive a spoken answer.' });
  };

  const stopSpeaking = () => {
    playback.stop();
    setState('idle');
  };

  const status = STATUS[state];
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.icon}><Ionicons name="mic" size={24} color="#10B981" /></View>
        <Text style={styles.title}>Voice AI Business Advisor</Text>
        <Text style={styles.subtitle}>{status.label}</Text>

        <View style={styles.languageSelector}>
          {LANGUAGES.map((item) => (
            <TouchableOpacity
              key={item.code}
              style={[styles.languageOption, language === item.code && styles.languageOptionActive]}
              onPress={() => selectLanguage(item.code)}
              disabled={state !== 'idle'}
            >
              <Text style={[styles.languageText, language === item.code && styles.languageTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.waveform} accessibilityLabel={state === 'listening' ? 'Recording in progress' : 'Voice recorder'}>
          {[0.55, 0.8, 1, 0.7, 0.45, 0.9, 0.65].map((height, index) => (
            <Animated.View key={index} style={[styles.waveBar, { height: 46 * height, opacity: ['listening', 'speaking'].includes(state) ? wave : 0.28 }]} />
          ))}
        </View>

        {state === 'speaking' ? (
          <TouchableOpacity accessibilityRole="button" style={styles.stopSpeakingButton} onPress={stopSpeaking} activeOpacity={0.8}>
            <Ionicons name="stop-circle" size={21} color="#fff" />
            <Text style={styles.stopSpeakingText}>Stop Speaking</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Hold to talk to the voice business advisor"
              style={[styles.micButton, state === 'listening' && styles.micButtonListening, state !== 'idle' && state !== 'listening' && styles.micButtonDisabled]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={state !== 'idle' && state !== 'listening'}
              activeOpacity={0.8}
            >
              {state === 'thinking' ? <ActivityIndicator color="#fff" /> : <Ionicons name={state === 'listening' ? 'stop' : 'mic'} size={32} color="#fff" />}
            </TouchableOpacity>
            <Text style={styles.hint}>{state === 'listening' ? 'Release to send' : 'Hold to talk · automatically stops after 45 seconds'}</Text>
          </>
        )}
        <Text style={styles.disclosure}>The spoken reply is AI-generated.</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>YOU SAID</Text>
          <Text style={styles.transcript}>{result.transcript}</Text>
          <View style={styles.answerHeader}><Ionicons name="sparkles" size={16} color="#10B981" /><Text style={styles.answerLabel}>AI ADVISOR</Text></View>
          <Text style={styles.answer}>{result.answer}</Text>
          {state === 'speaking' && <Text style={styles.speaking}><Ionicons name="volume-high" size={14} color="#10B981" /> Playing response</Text>}
        </View>
      )}

      <View style={styles.suggestions}>
        <Text style={styles.suggestionLabel}>SUGGESTED QUESTIONS</Text>
        <View style={styles.chips}>{QUESTIONS.map((question) => <TouchableOpacity key={question} style={[styles.chip, state === 'speaking' && styles.chipDisabled]} onPress={() => askSuggestion(question)} disabled={state === 'speaking'}><Text style={styles.chipText}>{question}</Text></TouchableOpacity>)}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', padding: 20, paddingBottom: 32 },
  card: { width: '100%', maxWidth: 620, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E2D9', borderRadius: 20, alignItems: 'center', padding: 28 },
  icon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 12, color: '#111827', fontSize: 19, fontWeight: '800' },
  subtitle: { marginTop: 6, color: '#6B7280', fontSize: 14, textAlign: 'center' },
  languageSelector: { flexDirection: 'row', gap: 8, marginTop: 18 },
  languageOption: { borderWidth: 1, borderColor: '#E8E2D9', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff' },
  languageOptionActive: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  languageText: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  languageTextActive: { color: '#047857' },
  waveform: { height: 66, marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 6 },
  waveBar: { width: 6, borderRadius: 6, backgroundColor: '#10B981' },
  micButton: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  micButtonListening: { backgroundColor: '#EF4444' }, micButtonDisabled: { opacity: 0.6 },
  stopSpeakingButton: { minHeight: 58, borderRadius: 29, backgroundColor: '#EF4444', marginTop: 18, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  stopSpeakingText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  hint: { marginTop: 12, color: '#6B7280', fontSize: 12, textAlign: 'center' }, disclosure: { marginTop: 5, color: '#9CA3AF', fontSize: 11 },
  error: { color: '#B91C1C', marginTop: 16, maxWidth: 620, width: '100%', textAlign: 'center' },
  resultCard: { width: '100%', maxWidth: 620, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E2D9', borderRadius: 16, padding: 18, marginTop: 18 },
  resultLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }, transcript: { color: '#111827', fontSize: 15, marginTop: 5, lineHeight: 22 },
  answerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 }, answerLabel: { color: '#10B981', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }, answer: { color: '#374151', marginTop: 6, fontSize: 14, lineHeight: 22 }, speaking: { color: '#10B981', marginTop: 12, fontSize: 12 },
  suggestions: { width: '100%', maxWidth: 620, marginTop: 22 }, suggestionLabel: { color: '#6B7280', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 10 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#E8E2D9', borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 9 }, chipDisabled: { opacity: 0.45 }, chipText: { color: '#374151', fontSize: 13 },
});
