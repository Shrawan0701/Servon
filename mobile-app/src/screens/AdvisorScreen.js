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
  bg: '#F3F5F2',
  card: '#FFFFFF',
  border: '#DFE5DF',
  text: '#20332A',
  subtext: '#627166',
  muted: '#839087',
  green: '#39805A',
  greenBg: '#EAF2EC',
  greenSoft: '#DCE9DF',
  navy: '#244F3B',
  cream: '#FFFFFF',
  amber: '#B45309',
  amberBg: '#FEF3C7',
  amberIcon: '#F59E0B',
  inputBg: '#F3F4F6',
  red: '#EF4444',
  redBg: '#FEF2F2',
};

const SHOW_VOICE_ADVISOR_UI = false;

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
  const [visibleConversations, setVisibleConversations] = useState([]);
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
  const contentMaxWidth = isWide ? 880 : isTablet ? 680 : '100%';
  const horizontalPadding = isTablet ? 24 : 16;
  const bubbleMaxWidth = isTablet ? Math.min(width * 0.7, 520) : width * 0.82;

  // ─── HISTORY SIDEBAR STATE (docked on tablet/web, overlay on mobile) ─
  const [sidebarOpen, setSidebarOpen] = useState(isTablet);
  const [showOlderHistory, setShowOlderHistory] = useState(false);
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

  useEffect(() => {
    if (!SHOW_VOICE_ADVISOR_UI && activeTab === 'voice') {
      setActiveTab('chat');
    }
  }, [activeTab]);

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
    const tempConversation = { id: Date.now(), question: userQuestion, answer: '', is_loading: true };
    setQuestion('');

    setConversations(prev => [...prev, tempConversation]);
    setVisibleConversations(prev => [...prev, tempConversation]);

    try {
      const res = await API.post('/advisor/ask', { question: userQuestion });
      const savedConversation = {
        id: res.data.id || Date.now(),
        question: res.data.question,
        answer: res.data.answer,
        created_at: new Date().toISOString(),
      };
      setConversations(prev => {
        const index = prev.findIndex(msg => msg.is_loading);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = savedConversation;
        return updated;
      });
      setVisibleConversations(prev => {
        const index = prev.findIndex(msg => msg.is_loading);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = savedConversation;
        return updated;
      });
    } catch (err) {
      console.error('Ask error:', err);
      const failedConversation = {
        id: tempConversation.id,
        question: userQuestion,
        answer: 'Sorry, I could not answer that. Please try again.',
        is_loading: false,
        is_error: true,
      };
      setConversations(prev => {
        const index = prev.findIndex(msg => msg.is_loading);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = failedConversation;
        return updated;
      });
      setVisibleConversations(prev => {
        const index = prev.findIndex(msg => msg.is_loading);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = failedConversation;
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
      setVisibleConversations(prev => prev.filter(item => item.id !== deleteTargetId));
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
      setVisibleConversations([]);
    } catch (err) {
      console.error('Clear all error:', err);
    } finally {
      setShowClearModal(false);
    }
  };

  // ─── JUMP TO A MESSAGE FROM THE HISTORY SIDEBAR ────────────────────
  const scrollToMessage = (id) => {
    const historyItem = conversations.find((item) => item.id === id);
    if (historyItem) {
      setVisibleConversations([historyItem]);
    }

    setTimeout(() => {
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
    }, 50);
    if (!isTablet) setSidebarOpen(false);
  };

  // ─── AUTO-SCROLL ──────────────────────────────────────────────────
  useEffect(() => {
    if (visibleConversations.length > 0 && !visibleConversations[visibleConversations.length - 1]?.is_loading) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [visibleConversations]);

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
        <View style={styles.userMessageRow}>
          <View style={[styles.userMessage, { maxWidth: bubbleMaxWidth }]}>
            <LocalizedText style={styles.userMessageText}>{item.question}</LocalizedText>
          </View>
          <TouchableOpacity style={styles.deleteIconWrap} onPress={() => onDelete(item.id)} activeOpacity={0.7}>
            <Ionicons name="close" size={13} color={COLORS.muted} />
          </TouchableOpacity>
        </View>
        <View style={styles.aiMessageRow}>
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={14} color={COLORS.green} />
          </View>
          <View style={[styles.aiMessage, { maxWidth: bubbleMaxWidth }, item.is_error && styles.aiMessageError]}>
            {item.is_loading ? (
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={COLORS.green} />
                <LocalizedText translate style={styles.typingText}>Thinking...</LocalizedText>
              </View>
            ) : (
              <View style={styles.aiMessageInner}>
                <View style={styles.aiAnswerHeader}>
                  <Ionicons name="analytics-outline" size={13} color={COLORS.green} />
                  <LocalizedText style={styles.aiAnswerLabel}>Advisor insight</LocalizedText>
                </View>
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
      <LocalizedText style={styles.emptyTitle}>Ask smarter, decide faster</LocalizedText>
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
            style={[styles.suggestionChip, { width: isWide ? '48.8%' : '100%', minHeight: isTablet ? 84 : 64 }]}
            activeOpacity={0.7}
            disabled={disabled}
            onPress={() => onSelect(sq.text)}
          >
            <View style={styles.suggestionChipIconWrap}>
              <Ionicons name={sq.icon} size={19} color={COLORS.green} />
            </View>
            <LocalizedText style={styles.suggestionChipText} numberOfLines={2}>{sq.text}</LocalizedText>
            <Ionicons name="arrow-forward" size={16} color={COLORS.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ─── HISTORY SIDEBAR (docked on tablet/web, slide-over on mobile) ──
  const HistorySidebarContent = ({ onClose, showClose }) => {
    const hasAny = conversations.length > 0;
    const showAllHistory = isTablet || showOlderHistory;
    const visibleHistoryGroups = showAllHistory ? GROUP_ORDER : ['Today'];
    const hasVisibleHistory = visibleHistoryGroups.some((label) => sidebarGroups[label]?.length > 0);
    const olderHistoryCount = GROUP_ORDER
      .filter((label) => label !== 'Today')
      .reduce((total, label) => total + (sidebarGroups[label]?.length || 0), 0);

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

        <ScrollView
          style={styles.sidebarScroll}
          contentContainerStyle={styles.sidebarScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!hasAny ? (
            <View style={styles.sidebarEmpty}>
              <Ionicons name="time-outline" size={20} color={COLORS.muted} />
              <LocalizedText translate style={styles.sidebarEmptyText}>No questions yet</LocalizedText>
            </View>
          ) : !hasVisibleHistory ? (
            <View style={styles.sidebarEmptyCompact}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.muted} />
              <LocalizedText translate style={styles.sidebarEmptyText}>No chats today</LocalizedText>
            </View>
          ) : (
            visibleHistoryGroups.map((label) => {
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
                      <Ionicons name="chatbubble-outline" size={15} color={COLORS.muted} />
                      <LocalizedText style={styles.sidebarItemText} numberOfLines={2}>
                        {item.question}
                      </LocalizedText>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })
          )}
          {!showAllHistory && olderHistoryCount > 0 && (
            <TouchableOpacity
              style={styles.loadMoreHistoryBtn}
              activeOpacity={0.75}
              onPress={() => setShowOlderHistory(true)}
            >
              <Ionicons name="chevron-down" size={16} color={COLORS.green} />
              <LocalizedText translate style={styles.loadMoreHistoryText}>Load more chats</LocalizedText>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerInner, { maxWidth: 1600, paddingHorizontal: horizontalPadding }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (!isTablet && !sidebarOpen) setShowOlderHistory(false);
                setSidebarOpen((prev) => !prev);
              }}
              style={styles.navBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.headerCenter, !isTablet && styles.headerCenterCompact]}>
            <View style={[styles.headerIconWrap, !isTablet && { display: 'none' }]}>
              <Ionicons name="sparkles" size={18} color={COLORS.green} />
            </View>
            <View style={styles.headerTitleWrap}>
              <LocalizedText translate style={[styles.title, !isTablet && { fontSize: 15 }]} numberOfLines={1}>AI Business Advisor</LocalizedText>
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

      <View style={[styles.tabBar, !SHOW_VOICE_ADVISOR_UI && { display: 'none' }]}>
        <TouchableOpacity style={[styles.tab, activeTab === 'chat' && styles.tabActive]} onPress={() => setActiveTab('chat')}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={activeTab === 'chat' ? COLORS.green : COLORS.subtext} />
          <LocalizedText translate style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Chat</LocalizedText>
        </TouchableOpacity>
        {SHOW_VOICE_ADVISOR_UI && (
          <TouchableOpacity style={[styles.tab, activeTab === 'voice' && styles.tabActive]} onPress={() => setActiveTab('voice')}>
            <Ionicons name="mic-outline" size={16} color={activeTab === 'voice' ? COLORS.green : COLORS.subtext} />
            <LocalizedText translate style={[styles.tabText, activeTab === 'voice' && styles.tabTextActive]}>Voice</LocalizedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Body: docked sidebar (tablet/web) + main column */}
      <View style={styles.bodyRow}>
        {isTablet && sidebarOpen && (
          <View style={styles.dockedSidebar}>
            <HistorySidebarContent />
          </View>
        )}

        <View style={styles.mainColumn}>
          {SHOW_VOICE_ADVISOR_UI && activeTab === 'voice' ? (
            <VoiceAdvisorTab onConversationSaved={loadConversations} language={language} />
          ) : (
            <>
          <ScrollView
            ref={scrollRef}
            style={styles.content}
            contentContainerStyle={{
              alignItems: 'center',
              flexGrow: visibleConversations.length === 0 ? 1 : 0,
              paddingBottom: 18,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              ref={contentRef}
              collapsable={false}
              style={{ width: '100%', maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding, flexGrow: visibleConversations.length === 0 ? 1 : 0, justifyContent: 'center' }}
            >
              {/* Conversations */}
              <View style={styles.section}>
                {visibleConversations.length > 0 && (
                  <View style={styles.sectionHeader}>
                    <Ionicons name="chatbubbles-outline" size={16} color={COLORS.text} />
                    <LocalizedText translate style={styles.sectionTitle}>Your Questions</LocalizedText>
                  </View>
                )}

                {visibleConversations.length === 0 ? (
                  <View style={[styles.emptyWrap, !isTablet && styles.emptyWrapCompact]}>
                    <EmptyState icon="chatbox-ellipses-outline" text="Ask your first question below, or try one of these." />
                    <SuggestedQuestions onSelect={askQuestion} disabled={asking} />
                  </View>
                ) : (
                  <View style={styles.chatTimeline}>
                    {visibleConversations.map(item => (
                      <View
                        key={item.id}
                        ref={(el) => { messageRefs.current[item.id] = el; }}
                        collapsable={false}
                      >
                        <MessageBubble item={item} onDelete={confirmDelete} />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Input Area */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
           <View style={[styles.inputWrap, { paddingBottom: (Platform.OS === 'android' ? 10 : 0) + insets.bottom }]}>
              <View style={[styles.inputContainer, { maxWidth: contentMaxWidth, marginHorizontal: 'auto', width: '100%' }]}>
                <View style={styles.inputFieldShell}>
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="sparkles-outline" size={16} color={COLORS.green} />
                  </View>
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
                </View>
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
            <Animated.View
              style={[
                styles.overlayPanel,
                {
                  transform: [{ translateX: sidebarTranslateX }],
                  marginTop: insets.top + 12,
                  marginBottom: insets.bottom + 12,
                },
              ]}
            >
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
  headerCenterCompact: { marginLeft: -8 },
  emptyWrapCompact: { paddingVertical: 6, paddingHorizontal: 0 },
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border, alignItems: 'center' },
  headerInner: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 16 },
  tabBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.88)', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999 },
  tabActive: { backgroundColor: COLORS.greenBg, borderWidth: 1, borderColor: COLORS.greenSoft },
  tabText: { color: COLORS.subtext, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: COLORS.green },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10 },
  headerIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.greenBg, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { minWidth: 0, flexShrink: 1 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text, flexShrink: 1, letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 12, lineHeight: 17, color: COLORS.subtext, marginTop: 3 },

  // ─── BODY / LAYOUT ────────────────────────────────────────────────
  bodyRow: { flex: 1, flexDirection: 'row', minHeight: 0 },
  mainColumn: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: COLORS.bg },

  content: { flex: 1 },
  section: { marginTop: 24, paddingBottom: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.subtext },
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

  chatTimeline: { paddingVertical: 4 },
  messageContainer: { marginBottom: 28 },
  userMessageRow: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 8, marginBottom: 16, minWidth: 0 },
  userMessage: { backgroundColor: COLORS.navy, borderRadius: 14, borderBottomRightRadius: 4, paddingHorizontal: 18, paddingVertical: 13, flexShrink: 1, minWidth: 0 },
  userMessageText: { color: '#FFFFFF', fontSize: 15, lineHeight: 23, flexWrap: 'wrap', fontWeight: '500' },

  aiMessageRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start', gap: 10, minWidth: 0 },
  aiAvatar: { width: 30, height: 30, borderRadius: 9, backgroundColor: COLORS.greenBg, alignItems: 'center', justifyContent: 'center', marginTop: 4, borderWidth: 1, borderColor: COLORS.greenSoft },
  aiMessage: { backgroundColor: COLORS.card, borderRadius: 12, borderTopLeftRadius: 4, paddingHorizontal: 18, paddingVertical: 16, borderWidth: 1, borderColor: COLORS.border, flexShrink: 1, minWidth: 0 },
  aiMessageInner: { minWidth: 0 },
  aiAnswerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  aiAnswerLabel: { fontSize: 12, color: COLORS.green, fontWeight: '600' },
  aiMessageError: { borderColor: '#FCA5A5', backgroundColor: COLORS.redBg },
  aiMessageText: { color: COLORS.text, fontSize: 15, lineHeight: 24, flexShrink: 1, flexWrap: 'wrap' },
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
  stepNumber: { fontSize: 15, fontWeight: '700', lineHeight: 24, color: COLORS.text, marginRight: 6, minWidth: 20 },
  stepContentWrap: {
    flex: 1,
    minWidth: 0,
  },
  stepContent: { fontSize: 15, color: COLORS.text, lineHeight: 24 },

  emptyWrap: { paddingVertical: 28, paddingHorizontal: 6 },
  emptyState: { alignItems: 'flex-start', paddingBottom: 30, gap: 12 },
  emptyIconWrap: { width: 52, height: 52, borderRadius: 15, marginBottom: 6, backgroundColor: COLORS.greenBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.greenSoft },
  emptyTitle: { fontSize: 28, lineHeight: 36, color: COLORS.text, fontWeight: '700', letterSpacing: -0.7 },
  emptyText: { fontSize: 14, color: COLORS.subtext, lineHeight: 22 },

  // ─── SUGGESTED QUESTIONS ────────────────────────────────────────────
  suggestionsWrap: { paddingTop: 22, borderTopWidth: 1, borderTopColor: COLORS.border },
  suggestionsLabel: { fontSize: 12, fontWeight: '600', color: COLORS.subtext, marginBottom: 14 },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 14, minHeight: 84 },
  suggestionChipIconWrap: { width: 34, height: 34, flexShrink: 0, borderRadius: 10, backgroundColor: COLORS.greenBg, alignItems: 'center', justifyContent: 'center' },
  suggestionChipText: { fontSize: 14, lineHeight: 21, color: COLORS.text, fontWeight: '500', flex: 1, minWidth: 0 },

  inputWrap: { backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center', paddingBottom: Platform.OS === 'android' ? 10 : 0 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
  inputFieldShell: { flex: 1, minWidth: 0, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: '#CCD8CE', paddingHorizontal: 14, paddingVertical: 10 },
  inputIconWrap: { width: 24, height: 28, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 0, paddingVertical: 4, fontSize: 15, lineHeight: 22, maxHeight: 100, color: COLORS.text, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
  sendBtn: { backgroundColor: COLORS.navy, borderRadius: 12, width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  deleteIconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', marginTop: 2, borderWidth: 1, borderColor: COLORS.border },

  // ─── HISTORY SIDEBAR (docked + drawer share these) ─────────────────
  dockedSidebar: { width: 264, borderRightWidth: 1, borderRightColor: COLORS.border, backgroundColor: COLORS.card },
  sidebarInner: { flex: 1, paddingTop: 12 },
  sidebarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sidebarHeaderTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sidebarHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sidebarIconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: COLORS.bg },
  sidebarScroll: { flex: 1 },
  sidebarScrollContent: { paddingBottom: 20 },
  sidebarGroup: { marginTop: 22, paddingHorizontal: 12 },
  sidebarGroupLabel: { fontSize: 11, fontWeight: '600', color: COLORS.subtext, marginBottom: 10, paddingHorizontal: 8 },
  sidebarItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 9, marginBottom: 5, backgroundColor: '#F6F8F5' },
  sidebarItemText: { flex: 1, minWidth: 0, fontSize: 13, color: COLORS.text, lineHeight: 19 },
  sidebarEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  sidebarEmptyCompact: { alignItems: 'center', justifyContent: 'center', paddingVertical: 22, gap: 8 },
  sidebarEmptyText: { fontSize: 13, color: COLORS.muted },
  loadMoreHistoryBtn: { marginHorizontal: 12, marginTop: 12, paddingVertical: 12, borderRadius: 9, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.greenBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  loadMoreHistoryText: { fontSize: 13, fontWeight: '600', color: COLORS.green },

  // Mobile drawer overlay
  overlayContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overlayPanel: { width: '84%', maxWidth: 320, height: '90%', backgroundColor: COLORS.card, borderTopRightRadius: 16, borderBottomRightRadius: 16, overflow: 'hidden', shadowColor: '#20332A', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },

  // ─── DELETE MODAL STYLES ──────────────────────────────────────────
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModal: { backgroundColor: COLORS.card, borderRadius: 16, padding: 24, width: '88%', maxWidth: 360, alignItems: 'center' },
  deleteModalTitle: { fontSize: 19, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  deleteModalText: { fontSize: 14, lineHeight: 22, color: COLORS.subtext, textAlign: 'center', marginBottom: 24 },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalBtn: { flex: 1, paddingVertical: 14, borderRadius: 9, alignItems: 'center' },
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
