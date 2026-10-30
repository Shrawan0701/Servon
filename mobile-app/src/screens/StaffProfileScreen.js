import React, { useState, useEffect } from 'react';
import {
    View,
    Text as NativeText,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Modal,
    TextInput,
    RefreshControl,
    Platform,
    useWindowDimensions,
} from "react-native";
import LocalizedText, { localizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getStaffById, updateStaff, markSalaryPaid } from '../api';

const StaffProfileScreen = ({ route, navigation }) => {
    const { language } = useLocale();
    const { width } = useWindowDimensions();
    const wideLayout = width >= 900;
    const compactLayout = width < 600;
    const { staffId } = route.params;
    const [staff, setStaff] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        role: '',
        joining_date: '',
        monthly_salary: '',
    });
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');

    const loadStaffDetails = async () => {
        try {
            setLoading(true);
            const response = await getStaffById(staffId);
            setStaff(response.data);
            setFormData({
                name: response.data.name,
                email: response.data.email || '',
                phone: response.data.phone,
                role: response.data.role,
                joining_date: response.data.joining_date,
                monthly_salary: response.data.monthly_salary.toString(),
            });
            setPaymentAmount(response.data.monthly_salary.toString());
        } catch (error) {
            console.error('Error loading staff details:', error);
            Alert.alert('Error', 'Failed to load staff details');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStaffDetails();
    }, [staffId]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadStaffDetails();
        setRefreshing(false);
    };

    const handleEditStaff = async () => {
        try {
            const data = {
                ...formData,
                monthly_salary: parseFloat(formData.monthly_salary),
            };
            await updateStaff(staffId, data);
            Alert.alert('Success', 'Staff member updated successfully');
            setEditModalVisible(false);
            loadStaffDetails();
        } catch (error) {
            console.error('Error updating staff:', error);
            Alert.alert('Error', 'Failed to update staff member');
        }
    };

    const handlePaySalary = async () => {
        try {
            await markSalaryPaid(
                staffId,
                parseFloat(paymentAmount),
                paymentNotes
            );
            Alert.alert('Success', 'Salary marked as paid');
            setPaymentModalVisible(false);
            loadStaffDetails();
        } catch (error) {
            console.error('Error marking salary:', error);
            Alert.alert('Error', 'Failed to mark salary as paid');
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatMonth = (monthString) => {
        const [year, month] = monthString.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
        });
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#39805A" />
            </View>
        );
    }

    if (!staff) {
        return (
            <View style={styles.errorContainer}>
                <LocalizedText translate style={styles.errorText}>Staff member not found</LocalizedText>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.workspace}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#39805A" />
            }
        >
            {/* Header */}
            <LinearGradient
                colors={['#FFFFFF', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.avatarRing}>
                    <View style={styles.avatarLarge}>
                        <LocalizedText style={styles.avatarLargeText}>
                            {staff.name.charAt(0).toUpperCase()}
                        </LocalizedText>
                    </View>
                </View>
                <View style={styles.identity}>
                <LocalizedText style={styles.name}>{staff.name}</LocalizedText>
                <View style={styles.rolePill}>
                    <LocalizedText style={styles.role}>{staff.role}</LocalizedText>
                </View>
                </View>

                <TouchableOpacity
                    style={styles.editButton}
                    activeOpacity={0.85}
                    onPress={() => setEditModalVisible(true)}
                >
                    <Ionicons name="create-outline" size={18} color="#39805A" />
                    <LocalizedText translate style={styles.editButtonText}>Edit Staff</LocalizedText>
                </TouchableOpacity>

                <View style={[styles.headerStatsRow, !wideLayout && styles.headerStatsCompact]}>
                    <View style={styles.headerStat}>
                        <LocalizedText style={styles.headerStatValue}>₹{staff.monthly_salary.toLocaleString()}</LocalizedText>
                        <LocalizedText translate style={styles.headerStatLabel}>MONTHLY</LocalizedText>
                    </View>
                    <View style={styles.headerStatDivider} />
                    <View style={styles.headerStat}>
                        <LocalizedText style={styles.headerStatValue}>{formatDate(staff.joining_date).split(' ').slice(0, 2).join(' ')}</LocalizedText>
                        <LocalizedText translate style={styles.headerStatLabel}>JOINED</LocalizedText>
                    </View>
                </View>
            </LinearGradient>

            <View style={[styles.detailsGrid, { flexDirection: wideLayout ? 'row' : 'column' }]}>
            {/* Contact Details */}
            <View style={[styles.section, { width: wideLayout ? '49.3%' : '100%' }]}>
                <LocalizedText translate style={styles.sectionEyebrow}>CONTACT DETAILS</LocalizedText>
               
                <View style={styles.detailItem}>
                    <View style={styles.detailIconChip}>
                        <Ionicons name="call-outline" size={17} color="#39805A" />
                    </View>
                    <View style={styles.detailTextWrap}>
                        <LocalizedText translate style={styles.detailLabel}>Phone</LocalizedText>
                        <LocalizedText style={styles.detailValue}>{staff.phone}</LocalizedText>
                    </View>
                </View>
                <View style={styles.detailItem}>
                    <View style={styles.detailIconChip}>
                        <Ionicons name="calendar-outline" size={17} color="#39805A" />
                    </View>
                    <View style={styles.detailTextWrap}>
                        <LocalizedText translate style={styles.detailLabel}>Joining Date</LocalizedText>
                        <LocalizedText style={styles.detailValue}>{formatDate(staff.joining_date)}</LocalizedText>
                    </View>
                </View>
                <View style={[styles.detailItem, { marginBottom: 0 }]}>
                    <View style={styles.detailIconChip}>
                        <Ionicons name="cash-outline" size={17} color="#39805A" />
                    </View>
                    <View style={styles.detailTextWrap}>
                        <LocalizedText translate style={styles.detailLabel}>Monthly Salary</LocalizedText>
                        <LocalizedText style={styles.detailValue}>₹{staff.monthly_salary.toLocaleString()}</LocalizedText>
                    </View>
                </View>
            </View>

            {/* Payment Status */}
            <View style={[styles.section, { width: wideLayout ? '49.3%' : '100%' }]}>
                <View style={styles.sectionHeader}>
                    <LocalizedText translate style={styles.sectionEyebrow}>CURRENT MONTH PAYMENT</LocalizedText>
                    <View style={[
                        styles.statusBadge,
                        staff.current_month_paid ? styles.paidBadge : styles.pendingBadge
                    ]}>
                        <View style={[
                            styles.statusDot,
                            staff.current_month_paid ? styles.paidDot : styles.pendingDot
                        ]} />
                        <LocalizedText style={[
                            styles.statusBadgeText,
                            staff.current_month_paid ? styles.paidBadgeText : styles.pendingBadgeText
                        ]}>
                            {staff.current_month_paid ? 'Paid' : 'Pending'}
                        </LocalizedText>
                    </View>
                </View>
                {staff.current_month_paid && staff.current_month_payment && (
                    <View style={styles.paymentDetails}>
                        <View style={styles.paymentDetailRow}>
                            <LocalizedText translate style={styles.paymentDetailLabel}>Amount</LocalizedText>
                            <LocalizedText style={styles.paymentDetailValue}>
                                ₹{staff.current_month_payment.amount.toLocaleString()}
                            </LocalizedText>
                        </View>
                        <View style={styles.paymentDetailRow}>
                            <LocalizedText translate style={styles.paymentDetailLabel}>Date</LocalizedText>
                            <LocalizedText style={styles.paymentDetailValue}>
                                {new Date(staff.current_month_payment.paid_date).toLocaleDateString()}
                            </LocalizedText>
                        </View>
                        {staff.current_month_payment.notes && (
                            <View style={styles.paymentDetailRow}>
                                <LocalizedText translate style={styles.paymentDetailLabel}>Notes</LocalizedText>
                                <LocalizedText style={[styles.paymentDetailValue, { flexShrink: 1, textAlign: 'right' }]}>
                                    {staff.current_month_payment.notes}
                                </LocalizedText>
                            </View>
                        )}
                    </View>
                )}
                {!staff.current_month_paid && (
                    <TouchableOpacity
                        style={styles.payButtonWrap}
                        activeOpacity={0.9}
                        onPress={() => setPaymentModalVisible(true)}
                    >
                        <LinearGradient
                            colors={['#2E503C', '#2E503C']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.payButton}
                        >
                            <Ionicons name="cash-outline" size={19} color="#fff" />
                            <LocalizedText translate style={styles.payButtonText}>Pay Salary</LocalizedText>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>
            </View>

            {/* Salary History */}
            <View style={styles.section}>
                <LocalizedText translate style={styles.sectionEyebrow}>SALARY HISTORY</LocalizedText>
                {staff.salary_history && staff.salary_history.length > 0 ? (
                    staff.salary_history.map((payment, idx) => (
                        <View
                            key={payment.id}
                            style={[
                                styles.historyItem,
                                idx === staff.salary_history.length - 1 && { borderBottomWidth: 0 }
                            ]}
                        >
                            <View style={styles.historyIconChip}>
                                <Ionicons name="checkmark" size={15} color="#39805A" />
                            </View>
                            <View style={styles.historyLeft}>
                                <LocalizedText style={styles.historyMonth}>
                                    {formatMonth(payment.month)}
                                </LocalizedText>
                                <LocalizedText style={styles.historyNotes}>
                                    {payment.notes || 'No notes'}
                                </LocalizedText>
                            </View>
                            <View style={styles.historyRight}>
                                <LocalizedText style={styles.historyAmount}>
                                    ₹{payment.amount.toLocaleString()}
                                </LocalizedText>
                                <LocalizedText style={styles.historyDate}>
                                    {new Date(payment.paid_date).toLocaleDateString()}
                                </LocalizedText>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyHistory}>
                        <Ionicons name="receipt-outline" size={28} color="#CBD5E1" />
                        <LocalizedText translate style={styles.emptyHistoryText}>No salary payments recorded</LocalizedText>
                    </View>
                )}
            </View>

            <View style={{ height: 24 }} />

            {/* Edit Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={editModalVisible}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={[styles.modalOverlay, compactLayout && styles.modalOverlayCompact]}>
                    <View style={[styles.modalContent, compactLayout && styles.modalContentCompact]}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <LocalizedText translate style={styles.modalTitle}>Edit Staff</LocalizedText>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setEditModalVisible(false)}
                            >
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <LocalizedText translate style={styles.inputLabel}>Full Name</LocalizedText>
                            <View style={styles.inputWrap}>
                                <Ionicons name="person-outline" size={18} color="#7B897F" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder={localizeText("Full Name *", language)}
                                    placeholderTextColor="#B4BCC8"
                                    value={formData.name}
                                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                                />
                            </View>

                            

                            <LocalizedText translate style={styles.inputLabel}>Phone</LocalizedText>
                            <View style={styles.inputWrap}>
                                <Ionicons name="call-outline" size={18} color="#7B897F" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder={localizeText("Phone *", language)}
                                    placeholderTextColor="#B4BCC8"
                                    value={formData.phone}
                                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                                    keyboardType="phone-pad"
                                />
                            </View>

                            <LocalizedText translate style={styles.inputLabel}>Role</LocalizedText>
                            <View style={styles.inputWrap}>
                                <Ionicons name="briefcase-outline" size={18} color="#7B897F" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder={localizeText("Role *", language)}
                                    placeholderTextColor="#B4BCC8"
                                    value={formData.role}
                                    onChangeText={(text) => setFormData({ ...formData, role: text })}
                                />
                            </View>

                            <LocalizedText translate style={styles.inputLabel}>Joining Date</LocalizedText>
                            <View style={styles.inputWrap}>
                                <Ionicons name="calendar-outline" size={18} color="#7B897F" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor="#B4BCC8"
                                    value={formData.joining_date}
                                    onChangeText={(text) => setFormData({ ...formData, joining_date: text })}
                                />
                            </View>

                            <LocalizedText translate style={styles.inputLabel}>Monthly Salary</LocalizedText>
                            <View style={styles.inputWrap}>
                                <LocalizedText translate style={styles.inputPrefix}>₹</LocalizedText>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    placeholderTextColor="#B4BCC8"
                                    value={formData.monthly_salary}
                                    onChangeText={(text) => setFormData({ ...formData, monthly_salary: text })}
                                    keyboardType="numeric"
                                />
                            </View>

                        </ScrollView>
                            <TouchableOpacity
                                style={styles.submitButtonWrap}
                                activeOpacity={0.9}
                                onPress={handleEditStaff}
                            >
                                <LinearGradient
                                    colors={['#2E503C', '#2E503C']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.submitButton}
                                >
                                    <LocalizedText translate style={styles.submitButtonText}>Update Staff</LocalizedText>
                                </LinearGradient>
                            </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Pay Salary Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={paymentModalVisible}
                onRequestClose={() => setPaymentModalVisible(false)}
            >
                <View style={[styles.modalOverlay, compactLayout && styles.modalOverlayCompact]}>
                    <View style={[styles.modalContent, compactLayout && styles.modalContentCompact]}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <LocalizedText translate style={styles.modalTitle}>Pay Salary</LocalizedText>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setPaymentModalVisible(false)}
                            >
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View style={styles.paymentInfoCard}>
                            <View style={styles.paymentInfoRow}>
                                <LocalizedText translate style={styles.paymentInfoLabel}>Staff</LocalizedText>
                                <LocalizedText style={styles.paymentInfoValue}>{staff.name}</LocalizedText>
                            </View>
                            <View style={styles.paymentInfoDivider} />
                            <View style={styles.paymentInfoRow}>
                                <LocalizedText translate style={styles.paymentInfoLabel}>Month</LocalizedText>
                                <LocalizedText style={styles.paymentInfoValue}>{new Date().toISOString().slice(0, 7)}</LocalizedText>
                            </View>
                        </View>

                        <LocalizedText translate style={styles.inputLabel}>Amount</LocalizedText>
                        <View style={styles.inputWrap}>
                            <LocalizedText translate style={styles.inputPrefix}>₹</LocalizedText>
                            <TextInput
                                style={styles.input}
                                placeholder="0"
                                placeholderTextColor="#B4BCC8"
                                value={paymentAmount}
                                onChangeText={setPaymentAmount}
                                keyboardType="numeric"
                            />
                        </View>

                        <LocalizedText translate style={styles.inputLabel}>Notes</LocalizedText>
                        <View style={styles.inputWrap}>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder={localizeText("Optional", language)}
                                placeholderTextColor="#B4BCC8"
                                value={paymentNotes}
                                onChangeText={setPaymentNotes}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        </ScrollView>
                        <TouchableOpacity
                            style={styles.submitButtonWrap}
                            activeOpacity={0.9}
                            onPress={handlePaySalary}
                        >
                            <LinearGradient
                                colors={['#2E503C', '#2E503C']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.submitButton}
                            >
                                <LocalizedText translate style={styles.submitButtonText}>Mark as Paid</LocalizedText>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({

  workspace: { width: '100%', maxWidth: 1240, alignSelf: 'center', padding: 20 },
  identity: { flex: 1, minWidth: 80 },
  detailsGrid: { justifyContent: 'space-between' },
  headerStatsCompact: { paddingTop: 16 },
  modalOverlayCompact: { justifyContent: 'flex-end', padding: 0 },
  modalContentCompact: { maxWidth: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: Platform.OS === 'ios' ? 32 : 20 },
  formScroll: { flexShrink: 1 },


  container: {  flex: 1, backgroundColor: '#F3F5F2'  },

  loadingContainer: {  flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F5F2'  },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#F3F5F2',
    },
    errorText: {
        fontSize: 16,
        color: '#EF4444',
        fontWeight: '600',
    },

  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFE5DF', borderRadius: 12, marginBottom: 20 },

  avatarRing: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#EAF2EC', justifyContent: 'center', alignItems: 'center' },

  avatarLarge: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#EAF2EC', justifyContent: 'center', alignItems: 'center' },

  avatarLargeText: { color: '#2E503C', fontSize: 23, fontWeight: '700' },

  name: { fontSize: 23, fontWeight: '700', color: '#20332A', letterSpacing: -0.4 },

  rolePill: { alignSelf: 'flex-start', marginTop: 5 },

  role: { fontSize: 14, color: '#627166' },

  headerStatsRow: { flexDirection: 'row', alignItems: 'center', width: '100%', borderTopWidth: 1, borderTopColor: '#E8EDE8', paddingTop: 18, marginTop: 2 },

  headerStat: { flex: 1, minWidth: 0, paddingHorizontal: 8 },

  headerStatDivider: { width: 1, height: 36, backgroundColor: '#DFE5DF' },

  headerStatValue: { fontSize: 18, fontWeight: '600', color: '#20332A' },

  headerStatLabel: { fontSize: 10, fontWeight: '500', color: '#627166', marginTop: 6 },

  section: { backgroundColor: '#FFFFFF', padding: 20, marginBottom: 20, borderRadius: 12, borderWidth: 1, borderColor: '#DFE5DF' },

  sectionEyebrow: { fontSize: 12, fontWeight: '600', color: '#627166', marginBottom: 20 },

  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 4 },

  detailItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },

  detailIconChip: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#F3F5F2', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    detailTextWrap: {
        flex: 1,
    },

  detailLabel: { fontSize: 12, color: '#627166', marginBottom: 5 },

  detailValue: { fontSize: 15, color: '#20332A', fontWeight: '500' },

  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, marginBottom: 16 },
    paidBadge: {
        backgroundColor: '#EAF2EC',
    },
    pendingBadge: {
        backgroundColor: '#FFFBEB',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    paidDot: {
        backgroundColor: '#39805A',
    },
    pendingDot: {
        backgroundColor: '#D97706',
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    paidBadgeText: {
        color: '#39805A',
    },
    pendingBadgeText: {
        color: '#D97706',
    },

  paymentDetails: { borderTopWidth: 1, borderTopColor: '#DFE5DF', paddingTop: 12 },

  paymentDetailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 10 },

  paymentDetailLabel: { fontSize: 13, color: '#627166' },

  paymentDetailValue: { fontSize: 14, color: '#20332A', fontWeight: '600' },

  payButtonWrap: { borderRadius: 9, overflow: 'hidden', marginTop: 12 },

  payButton: { flexDirection: 'row', padding: 14, minHeight: 46, alignItems: 'center', justifyContent: 'center' },

  payButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 8 },

  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E8EDE8', gap: 12 },

  historyIconChip: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EAF2EC', justifyContent: 'center', alignItems: 'center' },

  historyLeft: { flex: 1, minWidth: 0 },

  historyMonth: { fontSize: 14, fontWeight: '600', color: '#20332A', marginBottom: 5 },

  historyNotes: { fontSize: 12, lineHeight: 18, color: '#627166' },
    historyRight: {
        alignItems: 'flex-end',
    },

  historyAmount: { fontSize: 15, fontWeight: '600', color: '#20332A', marginBottom: 5 },

  historyDate: { fontSize: 12, color: '#627166' },
    emptyHistory: {
        alignItems: 'center',
        paddingVertical: 28,
    },
    emptyHistoryText: {
        fontSize: 13.5,
        color: '#627166',
        marginTop: 8,
        fontWeight: '500',
    },

  editButton: { flexDirection: 'row', backgroundColor: '#FFFFFF', minHeight: 42, paddingHorizontal: 14, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DFE5DF' },

  editButtonText: { color: '#2E503C', fontSize: 13, fontWeight: '600', marginLeft: 7 },

  modalOverlay: {  flex: 1, backgroundColor: 'rgba(23,38,30,0.48)', justifyContent: 'center', alignItems: 'center', padding: 24  },

  modalContent: {  width: '100%', maxWidth: 520, flexShrink: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, maxHeight: '92%'  },

  modalHandle: {  display: 'none'  },

  modalHeader: {  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 18, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#DFE5DF'  },

  modalTitle: {  fontSize: 21, fontWeight: '700', color: '#20332A', letterSpacing: -0.4  },

  modalCloseBtn: {  width: 36, height: 36, borderRadius: 9, backgroundColor: '#F3F5F2', justifyContent: 'center', alignItems: 'center'  },

  inputLabel: {  fontSize: 13, fontWeight: '600', color: '#405448', marginBottom: 8  },

  inputWrap: {  flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DFE5DF', borderRadius: 9, backgroundColor: '#FFFFFF', marginBottom: 18, paddingHorizontal: 12, minHeight: 46, flexShrink: 0  },
    inputIcon: {
        marginRight: 8,
    },

  inputPrefix: {  fontSize: 16, fontWeight: '600', color: '#627166', marginRight: 6  },

  input: {  flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 15, color: '#20332A', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {})  },
    textArea: {
        height: 76,
        textAlignVertical: 'top',
        paddingTop: 13,
    },

  submitButtonWrap: {  borderRadius: 10, overflow: 'hidden', marginTop: 10, flexShrink: 0  },

  submitButton: {  minHeight: 48, paddingVertical: 14, alignItems: 'center', justifyContent: 'center'  },

  submitButtonText: {  color: '#FFFFFF', fontSize: 15, fontWeight: '600'  },

  paymentInfoCard: {  backgroundColor: '#F3F5F2', borderRadius: 10, padding: 14, marginBottom: 22, borderWidth: 1, borderColor: '#DFE5DF'  },
    paymentInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    paymentInfoDivider: {
        height: 1,
        backgroundColor: '#E5E9F0',
        marginVertical: 6,
    },

  paymentInfoLabel: {  fontSize: 13, color: '#627166'  },

  paymentInfoValue: {  fontSize: 14, color: '#20332A', fontWeight: '600', flexShrink: 1, marginLeft: 16  },
});

export default StaffProfileScreen;
