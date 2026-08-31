import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text as NativeText,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Modal,
  Animated,
} from "react-native";
import LocalizedText, { localizeText } from "../components/LocalizedText";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import API from '../api';
import VoiceAdvisorTab from '../components/VoiceAdvisorTab';
import { useLocale } from '../context/LocaleContext';

const COLORS = {
  bg: '#FAF8F5',
  card: '#FFFFFF',
  border: '#E8E2D9',
  text: '#111827',
  subtext: '#6B7280',
  muted: '#9CA3AF',
  green: '#10B981',
  greenBg: '#ECFDF5',
  amber: '#B45309',
  amberBg: '#FEF3C7',
  amberIcon: '#F59E0B',
  inputBg: '#F3F4F6',
  red: '#EF4444',
  redBg: '#FEF2F2',
};

// ─── COMMON / SUGGESTED QUESTIONS ──────────────────────────────────
// Tapping a chip asks the question the same way typing + sending does.
const SUGGESTED_QUESTIONS = { en: [
  { icon: 'trending-up', text: 'How can I increase daily sales?' },
  { icon: 'pricetag-outline', text: 'How do I price my menu better?' },
  { icon: 'people-outline', text: 'How can I attract more customers?' },
  { icon: 'stats-chart-outline', text: "What's my biggest opportunity right now?" },
  { icon: 'megaphone-outline', text: 'What marketing should I focus on?' },
  { icon: 'cash-outline', text: 'How can I reduce operating costs?' },
], mr: [
  { icon: 'trending-up', text: 'दैनिक विक्री कशी वाढवू शकतो?' },
  { icon: 'pricetag-outline', text: 'मेनूची किंमत चांगली कशी ठरवू?' },
  { icon: 'people-outline', text: 'अधिक ग्राहक कसे आणू शकतो?' },
  { icon: 'stats-chart-outline', text: 'सध्या माझ्यासाठी मोठी संधी कोणती आहे?' },
  { icon: 'megaphone-outline', text: 'कोणत्या मार्केटिंगवर लक्ष द्यावे?' },
  { icon: 'cash-outline', text: 'कामकाजाचा खर्च कसा कमी करू?' },
], hi: [
  { icon: 'trending-up', text: 'मैं रोज़ की बिक्री कैसे बढ़ा सकता हूँ?' },
  { icon: 'pricetag-outline', text: 'मैं अपने मेनू की बेहतर कीमत कैसे तय करूँ?' },
  { icon: 'people-outline', text: 'मैं और ग्राहक कैसे ला सकता हूँ?' },
  { icon: 'stats-chart-outline', text: 'अभी मेरा सबसे बड़ा अवसर क्या है?' },
  { icon: 'megaphone-outline', text: 'मुझे किस मार्केटिंग पर ध्यान देना चाहिए?' },
  { icon: 'cash-outline', text: 'मैं संचालन लागत कैसे कम कर सकता हूँ?' },
] };

// ─── HELPER: Parse answer into segments ────────────────────────────
// Long, dense answers were rendering as a blank box on Android — a single
// Text node that wraps into a very large number of lines can fail to paint
// on some Android devices (the box reserves the right height, but nothing
// draws inside it). Splitting long content into several smaller Text nodes
// avoids ever handing Android one oversized block of text to render.
const MAX_CHUNK_LENGTH = 320;

const splitIntoChunks = (text) => {
  if (!text) return [''];
  if (text.length <= MAX_CHUNK_LENGTH) return [text];

  const chunks = [];
  let remaining = text;
  while (remaining.length > MAX_CHUNK_LENGTH) {
    let cut = remaining.lastIndexOf('. ', MAX_CHUNK_LENGTH);
    if (cut < MAX_CHUNK_LENGTH * 0.4) {
      cut = remaining.lastIndexOf(' ', MAX_CHUNK_LENGTH);
    }
    if (cut <= 0) cut = MAX_CHUNK_LENGTH;
    chunks.push(remaining.slice(0, cut + 1).trim());
    remaining = remaining.slice(cut + 1);
  }
  if (remaining.trim()) chunks.push(remaining.trim());
  return chunks;
};

const parseAnswer = (text) => {
  if (!text) return [{ type: 'text', content: '' }];
  const lines = text.split('\n');
  const segments = [];
  lines.forEach((line) => {
    const match = line.match(/^(\d+)\.\s*(.*)/);
    if (match) {
      segments.push({ type: 'step', number: match[1], chunks: splitIntoChunks(match[2]) });
    } else {
      segments.push({ type: 'text', chunks: splitIntoChunks(line) });
    }
  });
  return segments;
};

// ─── HELPER: Group items into ChatGPT-style date buckets ───────────
const GROUP_ORDER = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'];

const groupByDate = (list) => {
  const groups = { Today: [], Yesterday: [], 'Previous 7 Days': [], Older: [] };
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const sevenDaysAgo = new Date(startToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  [...list].reverse().forEach((item) => {
    const d = item.created_at ? new Date(item.created_at) : new Date();
    if (d >= startToday) groups.Today.push(item);
    else if (d >= startYesterday) groups.Yesterday.push(item);
    else if (d >= sevenDaysAgo) groups['Previous 7 Days'].push(item);
    else groups.Older.push(item);
  });
  return groups;
};

export default function AdvisorScreen() {
  const { language } = useLocale();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('chat');
  const [question, setQuestion] = useState('');
  const [conversations, setConversations] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const messageRefs = useRef({});

  // ─── DELETE MODAL STATE ─────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // ─── CLEAR ALL MODAL STATE ─────────────────────────────────────────
  const [showClearModal, setShowClearModal] = useState(false);

  // ─── RESPONSIVE LAYOUT ──────────────────────────────────────────────
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isWide = width >= 1024;
  const contentMaxWidth = isWide ? 760 : isTablet ? 640 : '100%';
  const horizontalPadding = isTablet ? 24 : 16;
  const bubbleMaxWidth = isTablet ? Math.min(width * 0.7, 520) : width * 0.82;

  // ─── HISTORY SIDEBAR STATE (docked on tablet/web, overlay on mobile) ─
  const [sidebarOpen, setSidebarOpen] = useState(isTablet);
  const insets = useSafeAreaInsets();
  const sidebarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isTablet && sidebarOpen) {
      sidebarAnim.setValue(0);
      Animated.timing(sidebarAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [sidebarOpen, isTablet]);

  const sidebarTranslateX = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-320, 0],
  });

  // ─── LOAD INSIGHTS ──────────────────────────────────────────────────
  const loadInsights = async () => {
    setLoading(true);
    try {
      const res = await API.get('/advisor/insights');
      setInsights(res.data.insights || []);
    } catch (err) {
      console.error('Insights load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── LOAD CONVERSATIONS ────────────────────────────────────────────
  const loadConversations = async () => {
    try {
      const res = await API.get('/advisor/conversations');
      setConversations(res.data.conversations.reverse() || []);
    } catch (err) {
      console.error('Conversations load error:', err);
    }
  };

  // ─── ASK QUESTION ──────────────────────────────────────────────────
  // Accepts an optional preset string so suggested-question chips can
  // trigger the exact same flow as typing + sending. When called from an
  // onPress/onSubmitEditing handler, the first argument is a native event
  // object (not a string), so we only treat it as the question text when
  // it's actually a string — otherwise we fall back to the typed value.
  const askQuestion = async (presetText) => {
    const textToAsk = (typeof presetText === 'string' ? presetText : question).trim();
    if (!textToAsk || asking) return;
    setAsking(true);
    const userQuestion = textToAsk;
    setQuestion('');

    setConversations(prev => [
      ...prev,
      { id: Date.now(), question: userQuestion, answer: '', is_loading: true },
    ]);

    try {
      const res = await API.post('/advisor/ask', { question: userQuestion });
      setConversations(prev => {
        const index = prev.findIndex(msg => msg.is_loading);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = {
          id: res.data.id || Date.now(),
          question: res.data.question,
          answer: res.data.answer,
          created_at: new Date().toISOString(),
        };
        return updated;
      });
    } catch (err) {
      console.error('Ask error:', err);
      setConversations(prev => {
        const index = prev.findIndex(msg => msg.is_loading);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          answer: 'Sorry, I could not answer that. Please try again.',
          is_loading: false,
          is_error: true,
        };
        return updated;
      });
    } finally {
      setAsking(false);
    }
  };

  // ─── DELETE SINGLE CONVERSATION ─────────────────────────────────────
  const confirmDelete = (id) => {
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await API.delete(`/advisor/conversations/${deleteTargetId}`);
      setConversations(prev => prev.filter(item => item.id !== deleteTargetId));
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setShowDeleteModal(false);
      setDeleteTargetId(null);
    }
  };

  // ─── CLEAR ALL CONVERSATIONS ──────────────────────────────────────
  const confirmClearAll = () => {
    if (conversations.length === 0) return;
    setShowClearModal(true);
  };

  const handleClearAll = async () => {
    try {
      await API.delete('/advisor/conversations');
      setConversations([]);
    } catch (err) {
      console.error('Clear all error:', err);
    } finally {
      setShowClearModal(false);
    }
  };

  // ─── JUMP TO A MESSAGE FROM THE HISTORY SIDEBAR ────────────────────
  const scrollToMessage = (id) => {
    const node = messageRefs.current[id];
    if (node) {
      if (typeof node.scrollIntoView === 'function') {
        // Web (react-native-web renders a real DOM node)
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (
        scrollRef.current &&
        contentRef.current &&
        typeof node.measureLayout === 'function'
      ) {
        // Native (iOS/Android) — measure against contentRef, a plain View
        // (the ScrollView itself is a composite component, not a native
        // host component, which is what caused the measureLayout warning)
        try {
          node.measureLayout(
            contentRef.current,
            (x, y) => {
              scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
            },
            () => {}
          );
        } catch (e) {
          // no-op fallback
        }
      }
    }
    if (!isTablet) setSidebarOpen(false);
  };

  // ─── AUTO-SCROLL ──────────────────────────────────────────────────
  useEffect(() => {
    if (conversations.length > 0 && !conversations[conversations.length - 1]?.is_loading) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [conversations]);

  useEffect(() => {
    loadInsights();
    loadConversations();
  }, []);

  const sidebarGroups = useMemo(() => groupByDate(conversations), [conversations]);

  // ─── SUB-COMPONENTS ─────────────────────────────────────────────────
  const InsightCard = ({ item }) => {
    // Instead of displaying negative red alerts, prioritize opportunities with a warm, encouraging amber styling
    const isHighPriority = item.priority >= 2;
    const accentColor = isHighPriority ? COLORS.amber : COLORS.green;
    const iconName = isHighPriority ? 'trending-up' : 'analytics';

    return (
      <View style={[styles.insightCard, isHighPriority ? styles.insightHighPriority : styles.insightNormalPriority]}>
        <View style={styles.insightHeader}>
          <View style={styles.insightTitleRow}>
            <Ionicons name={iconName} size={16} color={accentColor} />
            <LocalizedText style={styles.insightTitle}>{item.title}</LocalizedText>
          </View>
          {isHighPriority && (
            <View style={styles.priorityBadge}>
              <LocalizedText translate style={styles.priorityText}>High Impact</LocalizedText>
            </View>
          )}
        </View>
        <LocalizedText style={styles.insightDesc}>{item.description}</LocalizedText>
        {item.action_text && (
          <View style={styles.actionContainer}>
            <Ionicons name="bulb-outline" size={16} color={COLORS.amberIcon} />
            <LocalizedText style={styles.actionText}>{item.action_text}</LocalizedText>
          </View>
        )}
      </View>
    );
  };

  const MessageBubble = ({ item, onDelete }) => {
    const segments = parseAnswer(item.answer || '');

    return (
      <View style={styles.messageContainer}>
        <TouchableOpacity style={styles.deleteIconWrap} onPress={() => onDelete(item.id)} activeOpacity={0.7}>
          <Ionicons name="close-circle" size={18} color={COLORS.muted} />
        </TouchableOpacity>
        <View style={styles.userMessageRow}>
          <View style={[styles.userMessage, { maxWidth: bubbleMaxWidth }]}>
            <LocalizedText style={styles.userMessageText}>{item.question}</LocalizedText>
          </View>
        </View>
        <View style={styles.aiMessageRow}>
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={14} color={COLORS.green} />
          </View>
          <View style={[styles.aiMessage, { maxWidth: bubbleMaxWidth }, item.is_error && styles.aiMessageError]}>
            {item.is_loading ? (
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={COLORS.text} />
                <LocalizedText translate style={styles.typingText}>Thinking...</LocalizedText>
              </View>
            ) : (
              <View style={styles.aiMessageInner}>
                {segments.map((seg, idx) => {
                  if (seg.type === 'step') {
                    return (
                      <View key={idx} style={styles.stepRow}>
                        <LocalizedText style={styles.stepNumber}>{seg.number}.</LocalizedText>
                        <View style={styles.stepContentWrap}>
                          {seg.chunks.map((chunk, cIdx) => (
                            <LocalizedText key={cIdx} style={styles.stepContent}>{chunk}</LocalizedText>
                          ))}
                        </View>
                      </View>
                    );
                  } else {
                    const joined = seg.chunks.join(' ').trim();
                    if (joined === '') return null;
                    return (
                      <View key={idx} style={styles.aiMessageInner}>
                        {seg.chunks.map((chunk, cIdx) => (
                          <LocalizedText key={cIdx} style={styles.aiMessageText}>
                            {chunk}
                          </LocalizedText>
                        ))}
                      </View>
                    );
                  }
                })}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const EmptyState = ({ icon, text }) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={26} color={COLORS.green} />
      </View>
      <LocalizedText style={styles.emptyText}>{text}</LocalizedText>
    </View>
  );

  // ─── SUGGESTED / COMMON QUESTIONS ───────────────────────────────────
  const SuggestedQuestions = ({ onSelect, disabled }) => (
    <View style={styles.suggestionsWrap}>
      <LocalizedText translate style={styles.suggestionsLabel}>Common questions</LocalizedText>
      <View style={styles.suggestionsGrid}>
        {(SUGGESTED_QUESTIONS[language] || SUGGESTED_QUESTIONS.en).map((sq, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.suggestionChip}
            activeOpacity={0.7}
            disabled={disabled}
            onPress={() => onSelect(sq.text)}
          >
            <View style={styles.suggestionChipIconWrap}>
              <Ionicons name={sq.icon} size={14} color={COLORS.green} />
            </View>
            <LocalizedText style={styles.suggestionChipText} numberOfLines={2}>{sq.text}</LocalizedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ─── HISTORY SIDEBAR (docked on tablet/web, slide-over on mobile) ──
  const HistorySidebarContent = ({ onClose, showClose }) => {
    const hasAny = conversations.length > 0;
    return (
      <View style={styles.sidebarInner}>
        <View style={styles.sidebarHeader}>
          <LocalizedText translate style={styles.sidebarHeaderTitle}>History</LocalizedText>
          <View style={styles.sidebarHeaderActions}>
            {hasAny && (
              <TouchableOpacity onPress={confirmClearAll} style={styles.sidebarIconBtn} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={17} color={COLORS.muted} />
              </TouchableOpacity>
            )}
            {showClose && (
              <TouchableOpacity onPress={onClose} style={styles.sidebarIconBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={COLORS.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {!hasAny ? (
            <View style={styles.sidebarEmpty}>
              <Ionicons name="time-outline" size={20} color={COLORS.muted} />
              <LocalizedText translate style={styles.sidebarEmptyText}>No questions yet</LocalizedText>
            </View>
          ) : (
            GROUP_ORDER.map((label) => {
              const items = sidebarGroups[label];
              if (!items || items.length === 0) return null;
              return (
                <View key={label} style={styles.sidebarGroup}>
                  <LocalizedText style={styles.sidebarGroupLabel}>{label}</LocalizedText>
                  {items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.sidebarItem}
                      activeOpacity={0.6}
                      onPress={() => scrollToMessage(item.id)}
                    >
                      <LocalizedText style={styles.sidebarItemText} numberOfLines={2}>
                        {item.question}
                      </LocalizedText>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerInner, { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSidebarOpen((prev) => !prev)}
              style={styles.navBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.headerCenter}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="sparkles" size={18} color={COLORS.green} />
            </View>
            <View style={styles.headerTitleWrap}>
              <LocalizedText translate style={styles.title} numberOfLines={1}>AI Business Advisor</LocalizedText>
              <LocalizedText translate style={styles.headerSubtitle} numberOfLines={1}>Ask anything about your business</LocalizedText>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={styles.navBtn} activeOpacity={0.7}>
              <Ionicons name="home-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === 'chat' && styles.tabActive]} onPress={() => setActiveTab('chat')}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={activeTab === 'chat' ? COLORS.green : COLORS.subtext} />
          <LocalizedText translate style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Chat</LocalizedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'voice' && styles.tabActive]} onPress={() => setActiveTab('voice')}>
          <Ionicons name="mic-outline" size={16} color={activeTab === 'voice' ? COLORS.green : COLORS.subtext} />
          <LocalizedText translate style={[styles.tabText, activeTab === 'voice' && styles.tabTextActive]}>Voice</LocalizedText>
        </TouchableOpacity>
      </View>

      {/* Body: docked sidebar (tablet/web) + main column */}
      <View style={styles.bodyRow}>
        {isTablet && sidebarOpen && (
          <View style={styles.dockedSidebar}>
            <HistorySidebarContent />
          </View>
        )}

        <View style={styles.mainColumn}>
          {activeTab === 'voice' ? (
            <VoiceAdvisorTab onConversationSaved={loadConversations} language={language} />
          ) : (
            <>
          <ScrollView
            ref={scrollRef}
            style={styles.content}
            contentContainerStyle={{ alignItems: 'center', flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            <View
              ref={contentRef}
              collapsable={false}
              style={{ width: '100%', maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }}
            >
              {/* Conversations */}
              <View style={styles.section}>
                {conversations.length > 0 && (
                  <View style={styles.sectionHeader}>
                    <Ionicons name="chatbubbles-outline" size={16} color={COLORS.text} />
                    <LocalizedText translate style={styles.sectionTitle}>Your Questions</LocalizedText>
                  </View>
                )}

                {conversations.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <EmptyState icon="chatbox-ellipses-outline" text="Ask your first question below, or try one of these." />
                    <SuggestedQuestions onSelect={askQuestion} disabled={asking} />
                  </View>
                ) : (
                  conversations.map(item => (
                    <View
                      key={item.id}
                      ref={(el) => { messageRefs.current[item.id] = el; }}
                      collapsable={false}
                    >
                      <MessageBubble item={item} onDelete={confirmDelete} />
                    </View>
                  ))
                )}
              </View>
            </View>
          </ScrollView>

          {/* Input Area */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
           <View style={[styles.inputWrap, { paddingBottom: (Platform.OS === 'android' ? 10 : 0) + insets.bottom }]}>
              <View style={[styles.inputContainer, { maxWidth: contentMaxWidth, marginHorizontal: 'auto', width: '100%' }]}>
                <TextInput
                  style={styles.input}
                  placeholder={localizeText("Ask about your business...", language)}
                  placeholderTextColor={COLORS.muted}
                  value={question}
                  onChangeText={setQuestion}
                  onSubmitEditing={() => askQuestion()}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!question.trim() || asking) && styles.sendBtnDisabled]}
                  onPress={() => askQuestion()}
                  disabled={!question.trim() || asking}
                  activeOpacity={0.8}
                >
                  {asking ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
            </>
          )}
        </View>
      </View>

      {/* ─── MOBILE HISTORY DRAWER ─────────────────────────────────── */}
      {!isTablet && (
        <Modal
          visible={sidebarOpen}
          transparent
          animationType="none"
          onRequestClose={() => setSidebarOpen(false)}
        >
          <View style={styles.overlayContainer}>
            <Animated.View style={[styles.overlayPanel, { transform: [{ translateX: sidebarTranslateX }], paddingTop: insets.top, paddingBottom: insets.bottom }]}>
              <HistorySidebarContent onClose={() => setSidebarOpen(false)} showClose />
            </Animated.View>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setSidebarOpen(false)}
            />
          </View>
        </Modal>
      )}

      {/* ─── CUSTOM DELETE MODAL ────────────────────────────────────── */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModal}>
            <LocalizedText translate style={styles.deleteModalTitle}>Delete Chat?</LocalizedText>
            <LocalizedText translate style={styles.deleteModalText}>
              This conversation will be permanently removed.
            </LocalizedText>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalCancel]}
                onPress={() => setShowDeleteModal(false)}
              >
                <LocalizedText translate style={styles.deleteModalBtnText}>Cancel</LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalConfirm]}
                onPress={handleDelete}
              >
                <LocalizedText translate style={[styles.deleteModalBtnText, { color: '#fff' }]}>Delete</LocalizedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM CLEAR ALL MODAL ────────────────────────────────── */}
      <Modal visible={showClearModal} transparent animationType="fade">
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModal}>
            <LocalizedText translate style={styles.deleteModalTitle}>Clear All Chats?</LocalizedText>
            <LocalizedText translate style={styles.deleteModalText}>
              All conversations will be permanently removed. This action cannot be undone.
            </LocalizedText>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalCancel]}
                onPress={() => setShowClearModal(false)}
              >
                <LocalizedText translate style={styles.deleteModalBtnText}>Cancel</LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalConfirm]}
                onPress={handleClearAll}
              >
                <LocalizedText translate style={[styles.deleteModalBtnText, { color: '#fff' }]}>Clear All</LocalizedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  tabBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10 },
  tabActive: { backgroundColor: COLORS.greenBg },
  tabText: { color: COLORS.subtext, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: COLORS.green },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: { padding: 4 },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { minWidth: 0, flexShrink: 1 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.text, flexShrink: 1 },
  headerSubtitle: { fontSize: 11.5, color: COLORS.subtext, marginTop: 1 },

  // ─── BODY / LAYOUT ────────────────────────────────────────────────
  bodyRow: { flex: 1, flexDirection: 'row' },
  mainColumn: { flex: 1, minWidth: 0 },

  content: { flex: 1 },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  insightGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  insightGridItem: { width: '50%', paddingHorizontal: 6 },
  insightCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  insightHighPriority: { borderLeftColor: COLORS.amber },
  insightNormalPriority: { borderLeftColor: COLORS.green },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  insightTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  insightTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  priorityBadge: { backgroundColor: COLORS.amberBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priorityText: { fontSize: 10, fontWeight: '700', color: COLORS.amber },
  insightDesc: { fontSize: 13, color: COLORS.subtext, marginTop: 6, lineHeight: 20 },
  actionContainer: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, gap: 6 },
  actionText: { fontSize: 12, color: COLORS.amber, flex: 1, lineHeight: 18 },

  messageContainer: { marginBottom: 16 },
  userMessageRow: { alignSelf: 'flex-end', marginBottom: 8, minWidth: 0 },
  userMessage: {
    backgroundColor: COLORS.text,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  userMessageText: { color: '#fff', fontSize: 14, lineHeight: 20, flexWrap: 'wrap' },

  aiMessageRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'flex-end', gap: 8, minWidth: 0 },
  aiAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  aiMessage: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexShrink: 1,
    minWidth: 0,
  },
  aiMessageInner: { minWidth: 0 },
  aiMessageError: { borderColor: '#FCA5A5', backgroundColor: COLORS.redBg },
  aiMessageText: { color: COLORS.text, fontSize: 14, lineHeight: 21, flexShrink: 1, flexWrap: 'wrap' },
  aiMessageErrorText: { color: COLORS.red },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { color: COLORS.subtext, fontSize: 13 },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    marginTop: 4,
    minWidth: 0,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginRight: 6,
    minWidth: 20,
  },
  stepContentWrap: {
    flex: 1,
    minWidth: 0,
  },
  stepContent: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 21,
  },

  emptyWrap: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 24,
    paddingHorizontal: 18,
  },
  emptyState: { alignItems: 'center', paddingBottom: 18, gap: 10 },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 13, color: COLORS.subtext, textAlign: 'center' },

  // ─── SUGGESTED QUESTIONS ────────────────────────────────────────────
  suggestionsWrap: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  suggestionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    maxWidth: '100%',
  },
  suggestionChipIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionChipText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
    flexShrink: 1,
  },

  inputWrap: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'android' ? 10 : 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: COLORS.text,
  },
  sendBtn: {
    backgroundColor: COLORS.text,
    borderRadius: 14,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  deleteIconWrap: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 2,
  },

  // ─── HISTORY SIDEBAR (docked + drawer share these) ─────────────────
  dockedSidebar: {
    width: 280,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  sidebarInner: { flex: 1, paddingTop: 12 },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sidebarHeaderTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  sidebarHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sidebarIconBtn: { padding: 6, borderRadius: 8 },
  sidebarGroup: { marginTop: 14, paddingHorizontal: 12 },
  sidebarGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    paddingHorizontal: 6,
  },
  sidebarItem: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 2,
  },
  sidebarItemText: { fontSize: 13, color: COLORS.text, lineHeight: 18 },
  sidebarEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  sidebarEmptyText: { fontSize: 13, color: COLORS.muted },

  // Mobile drawer overlay
  overlayContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overlayPanel: {
    width: '80%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: COLORS.card,
  },

  // ─── DELETE MODAL STYLES ──────────────────────────────────────────
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  deleteModalText: {
    fontSize: 14,
    color: COLORS.subtext,
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteModalCancel: {
    backgroundColor: COLORS.bg,
  },
  deleteModalConfirm: {
    backgroundColor: COLORS.red,
  },
  deleteModalBtnText: {
    fontWeight: '700',
    fontSize: 14,
    color: COLORS.text,
  },
});
