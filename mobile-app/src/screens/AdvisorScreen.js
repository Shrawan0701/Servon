import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import API from '../api';

const COLORS = {
  bg: '#FAF8F5',
  card: '#FFFFFF',
  border: '#E8E2D9',
  text: '#111827',
  subtext: '#6B7280',
  muted: '#9CA3AF',
  green: '#10B981',
  red: '#EF4444',
  redBg: '#FEF2F2',
  amber: '#92400E',
  amberIcon: '#F59E0B',
  inputBg: '#F3F4F6',
};

// ─── HELPER: Parse answer into segments ────────────────────────────
const parseAnswer = (text) => {
  if (!text) return [{ type: 'text', content: '' }];
  const lines = text.split('\n');
  const segments = [];
  lines.forEach((line) => {
    const match = line.match(/^(\d+)\.\s*(.*)/);
    if (match) {
      segments.push({ type: 'step', number: match[1], content: match[2] });
    } else {
      segments.push({ type: 'text', content: line });
    }
  });
  return segments;
};

export default function AdvisorScreen() {
  const navigation = useNavigation();
  const [question, setQuestion] = useState('');
  const [conversations, setConversations] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef(null);

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
  const bubbleMaxWidth = isTablet ? '70%' : '85%';

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
  const askQuestion = async () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    const userQuestion = question.trim();
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

  // ─── SUB-COMPONENTS ─────────────────────────────────────────────────
  const InsightCard = ({ item }) => (
    <View style={[styles.insightCard, item.priority >= 2 && styles.insightHighPriority]}>
      <View style={styles.insightHeader}>
        <View style={styles.insightTitleRow}>
          <Ionicons name={item.priority >= 2 ? 'alert-circle' : 'checkmark-circle'} size={16} color={item.priority >= 2 ? COLORS.red : COLORS.green} />
          <Text style={styles.insightTitle}>{item.title}</Text>
        </View>
        {item.priority >= 2 && (
          <View style={styles.priorityBadge}>
            <Text style={styles.priorityText}>High</Text>
          </View>
        )}
      </View>
      <Text style={styles.insightDesc}>{item.description}</Text>
      {item.action_text && (
        <View style={styles.actionContainer}>
          <Ionicons name="bulb-outline" size={16} color={COLORS.amberIcon} />
          <Text style={styles.actionText}>{item.action_text}</Text>
        </View>
      )}
    </View>
  );

  const MessageBubble = ({ item, onDelete }) => {
    const segments = parseAnswer(item.answer || '');

    return (
      <View style={styles.messageContainer}>
        <TouchableOpacity style={styles.deleteIconWrap} onPress={() => onDelete(item.id)} activeOpacity={0.7}>
          <Ionicons name="close-circle" size={18} color={COLORS.muted} />
        </TouchableOpacity>
        <View style={[styles.userMessageRow, { maxWidth: bubbleMaxWidth }]}>
          <View style={styles.userMessage}>
            <Text style={styles.userMessageText}>{item.question}</Text>
          </View>
        </View>
        <View style={[styles.aiMessageRow, { maxWidth: bubbleMaxWidth }]}>
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={14} color={COLORS.green} />
          </View>
          <View style={[styles.aiMessage, item.is_error && styles.aiMessageError]}>
            {item.is_loading ? (
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={COLORS.text} />
                <Text style={styles.typingText}>Thinking...</Text>
              </View>
            ) : (
              <View>
                {segments.map((seg, idx) => {
                  if (seg.type === 'step') {
                    return (
                      <View key={idx} style={styles.stepRow}>
                        <Text style={styles.stepNumber}>{seg.number}.</Text>
                        <Text style={styles.stepContent}>{seg.content}</Text>
                      </View>
                    );
                  } else {
                    if (seg.content.trim() === '') return null;
                    return (
                      <Text key={idx} style={styles.aiMessageText}>
                        {seg.content}
                      </Text>
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
      <Ionicons name={icon} size={22} color={COLORS.muted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerInner, { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="sparkles" size={18} color={COLORS.green} />
            </View>
            <Text style={styles.title}>AI Business Advisor</Text>
          </View>

          <View style={styles.headerRight}>
            {conversations.length > 0 && (
              <TouchableOpacity onPress={confirmClearAll} activeOpacity={0.7} style={styles.clearBtn}>
                <Ionicons name="trash-outline" size={18} color={COLORS.muted} />
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={styles.navBtn} activeOpacity={0.7}>
              <Ionicons name="home-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={{ alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }}>
          {/* Insights Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="stats-chart-outline" size={16} color={COLORS.text} />
              <Text style={styles.sectionTitle}>Proactive Insights</Text>
            </View>
            {loading ? (
              <ActivityIndicator color={COLORS.text} style={{ marginTop: 8 }} />
            ) : insights.length > 0 ? (
              <View style={isTablet ? styles.insightGrid : undefined}>
                {insights.map(item => (
                  <View key={item.id} style={isTablet ? styles.insightGridItem : undefined}>
                    <InsightCard item={item} />
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState icon="bulb-outline" text="No insights yet. Ask a question to get started." />
            )}
          </View>

          {/* Conversations */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubbles-outline" size={16} color={COLORS.text} />
              <Text style={styles.sectionTitle}>Your Questions</Text>
            </View>
            {conversations.length === 0 ? (
              <EmptyState icon="chatbox-ellipses-outline" text="Ask your first question below." />
            ) : (
              conversations.map(item => <MessageBubble key={item.id} item={item} onDelete={confirmDelete} />)
            )}
          </View>
        </View>
      </ScrollView>

      {/* Input Area */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={styles.inputWrap}>
          <View style={[styles.inputContainer, { maxWidth: contentMaxWidth, marginHorizontal: 'auto', width: '100%' }]}>
            <TextInput
              style={styles.input}
              placeholder="Ask about your business..."
              placeholderTextColor={COLORS.muted}
              value={question}
              onChangeText={setQuestion}
              onSubmitEditing={askQuestion}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!question.trim() || asking) && styles.sendBtnDisabled]}
              onPress={askQuestion}
              disabled={!question.trim() || asking}
              activeOpacity={0.8}
            >
              {asking ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ─── CUSTOM DELETE MODAL ────────────────────────────────────── */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteModalTitle}>Delete Chat?</Text>
            <Text style={styles.deleteModalText}>
              This conversation will be permanently removed.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalCancel]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.deleteModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalConfirm]}
                onPress={handleDelete}
              >
                <Text style={[styles.deleteModalBtnText, { color: '#fff' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM CLEAR ALL MODAL ────────────────────────────────── */}
      <Modal visible={showClearModal} transparent animationType="fade">
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteModalTitle}>Clear All Chats?</Text>
            <Text style={styles.deleteModalText}>
              All conversations will be permanently removed. This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalCancel]}
                onPress={() => setShowClearModal(false)}
              >
                <Text style={styles.deleteModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalConfirm]}
                onPress={handleClearAll}
              >
                <Text style={[styles.deleteModalBtnText, { color: '#fff' }]}>Clear All</Text>
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
    paddingVertical: 14,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: { padding: 4 },
  headerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
  },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
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
    borderLeftColor: COLORS.green,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  insightHighPriority: { borderLeftColor: COLORS.red },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  insightTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  insightTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  priorityBadge: { backgroundColor: COLORS.redBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priorityText: { fontSize: 10, fontWeight: '700', color: COLORS.red },
  insightDesc: { fontSize: 13, color: COLORS.subtext, marginTop: 6, lineHeight: 20 },
  actionContainer: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, gap: 6 },
  actionText: { fontSize: 12, color: COLORS.amber, flex: 1, lineHeight: 18 },

  messageContainer: { marginBottom: 16 },
  userMessageRow: { alignSelf: 'flex-end', marginBottom: 8 },
  userMessage: {
    backgroundColor: COLORS.text,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userMessageText: { color: '#fff', fontSize: 14, lineHeight: 20 },

  aiMessageRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
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
  },
  aiMessageError: { borderColor: '#FCA5A5', backgroundColor: COLORS.redBg },
  aiMessageText: { color: COLORS.text, fontSize: 14, lineHeight: 21 },
  aiMessageErrorText: { color: COLORS.red },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { color: COLORS.subtext, fontSize: 13 },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    marginTop: 4,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginRight: 6,
    minWidth: 20,
  },
  stepContent: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
    lineHeight: 21,
  },

  emptyState: { alignItems: 'center', paddingVertical: 22, gap: 8 },
  emptyText: { fontSize: 13, color: COLORS.muted, textAlign: 'center' },

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