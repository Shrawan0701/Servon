import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Modal,
    TextInput,
    RefreshControl,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getStaffById, updateStaff, markSalaryPaid } from '../api';

const StaffProfileScreen = ({ route, navigation }) => {
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
                <ActivityIndicator size="large" color="#059669" />
            </View>
        );
    }

    if (!staff) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Staff member not found</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />
            }
        >
            {/* Header */}
            <LinearGradient
                colors={['#059669', '#047857']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.avatarRing}>
                    <View style={styles.avatarLarge}>
                        <Text style={styles.avatarLargeText}>
                            {staff.name.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                </View>
                <Text style={styles.name}>{staff.name}</Text>
                <View style={styles.rolePill}>
                    <Text style={styles.role}>{staff.role}</Text>
                </View>

                <View style={styles.headerStatsRow}>
                    <View style={styles.headerStat}>
                        <Text style={styles.headerStatValue}>₹{staff.monthly_salary.toLocaleString()}</Text>
                        <Text style={styles.headerStatLabel}>MONTHLY</Text>
                    </View>
                    <View style={styles.headerStatDivider} />
                    <View style={styles.headerStat}>
                        <Text style={styles.headerStatValue}>{formatDate(staff.joining_date).split(' ').slice(0, 2).join(' ')}</Text>
                        <Text style={styles.headerStatLabel}>JOINED</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Contact Details */}
            <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>CONTACT DETAILS</Text>
               
                <View style={styles.detailItem}>
                    <View style={styles.detailIconChip}>
                        <Ionicons name="call-outline" size={17} color="#059669" />
                    </View>
                    <View style={styles.detailTextWrap}>
                        <Text style={styles.detailLabel}>Phone</Text>
                        <Text style={styles.detailValue}>{staff.phone}</Text>
                    </View>
                </View>
                <View style={styles.detailItem}>
                    <View style={styles.detailIconChip}>
                        <Ionicons name="calendar-outline" size={17} color="#059669" />
                    </View>
                    <View style={styles.detailTextWrap}>
                        <Text style={styles.detailLabel}>Joining Date</Text>
                        <Text style={styles.detailValue}>{formatDate(staff.joining_date)}</Text>
                    </View>
                </View>
                <View style={[styles.detailItem, { marginBottom: 0 }]}>
                    <View style={styles.detailIconChip}>
                        <Ionicons name="cash-outline" size={17} color="#059669" />
                    </View>
                    <View style={styles.detailTextWrap}>
                        <Text style={styles.detailLabel}>Monthly Salary</Text>
                        <Text style={styles.detailValue}>₹{staff.monthly_salary.toLocaleString()}</Text>
                    </View>
                </View>
            </View>

            {/* Payment Status */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionEyebrow}>CURRENT MONTH PAYMENT</Text>
                    <View style={[
                        styles.statusBadge,
                        staff.current_month_paid ? styles.paidBadge : styles.pendingBadge
                    ]}>
                        <View style={[
                            styles.statusDot,
                            staff.current_month_paid ? styles.paidDot : styles.pendingDot
                        ]} />
                        <Text style={[
                            styles.statusBadgeText,
                            staff.current_month_paid ? styles.paidBadgeText : styles.pendingBadgeText
                        ]}>
                            {staff.current_month_paid ? 'Paid' : 'Pending'}
                        </Text>
                    </View>
                </View>
                {staff.current_month_paid && staff.current_month_payment && (
                    <View style={styles.paymentDetails}>
                        <View style={styles.paymentDetailRow}>
                            <Text style={styles.paymentDetailLabel}>Amount</Text>
                            <Text style={styles.paymentDetailValue}>
                                ₹{staff.current_month_payment.amount.toLocaleString()}
                            </Text>
                        </View>
                        <View style={styles.paymentDetailRow}>
                            <Text style={styles.paymentDetailLabel}>Date</Text>
                            <Text style={styles.paymentDetailValue}>
                                {new Date(staff.current_month_payment.paid_date).toLocaleDateString()}
                            </Text>
                        </View>
                        {staff.current_month_payment.notes && (
                            <View style={styles.paymentDetailRow}>
                                <Text style={styles.paymentDetailLabel}>Notes</Text>
                                <Text style={[styles.paymentDetailValue, { flexShrink: 1, textAlign: 'right' }]}>
                                    {staff.current_month_payment.notes}
                                </Text>
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
                            colors={['#34D399', '#059669']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.payButton}
                        >
                            <Ionicons name="cash-outline" size={19} color="#fff" />
                            <Text style={styles.payButtonText}>Pay Salary</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>

            {/* Salary History */}
            <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>SALARY HISTORY</Text>
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
                                <Ionicons name="checkmark" size={15} color="#059669" />
                            </View>
                            <View style={styles.historyLeft}>
                                <Text style={styles.historyMonth}>
                                    {formatMonth(payment.month)}
                                </Text>
                                <Text style={styles.historyNotes}>
                                    {payment.notes || 'No notes'}
                                </Text>
                            </View>
                            <View style={styles.historyRight}>
                                <Text style={styles.historyAmount}>
                                    ₹{payment.amount.toLocaleString()}
                                </Text>
                                <Text style={styles.historyDate}>
                                    {new Date(payment.paid_date).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyHistory}>
                        <Ionicons name="receipt-outline" size={28} color="#CBD5E1" />
                        <Text style={styles.emptyHistoryText}>No salary payments recorded</Text>
                    </View>
                )}
            </View>

            {/* Edit Button */}
            <TouchableOpacity
                style={styles.editButton}
                activeOpacity={0.85}
                onPress={() => setEditModalVisible(true)}
            >
                <Ionicons name="create-outline" size={19} color="#059669" />
                <Text style={styles.editButtonText}>Edit Staff</Text>
            </TouchableOpacity>
            <View style={{ height: 24 }} />

            {/* Edit Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={editModalVisible}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Staff</Text>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setEditModalVisible(false)}
                            >
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Full Name</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Full Name *"
                                    placeholderTextColor="#B4BCC8"
                                    value={formData.name}
                                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                                />
                            </View>

                            

                            <Text style={styles.inputLabel}>Phone</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="call-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Phone *"
                                    placeholderTextColor="#B4BCC8"
                                    value={formData.phone}
                                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                                    keyboardType="phone-pad"
                                />
                            </View>

                            <Text style={styles.inputLabel}>Role</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="briefcase-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Role *"
                                    placeholderTextColor="#B4BCC8"
                                    value={formData.role}
                                    onChangeText={(text) => setFormData({ ...formData, role: text })}
                                />
                            </View>

                            <Text style={styles.inputLabel}>Joining Date</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="calendar-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor="#B4BCC8"
                                    value={formData.joining_date}
                                    onChangeText={(text) => setFormData({ ...formData, joining_date: text })}
                                />
                            </View>

                            <Text style={styles.inputLabel}>Monthly Salary</Text>
                            <View style={styles.inputWrap}>
                                <Text style={styles.inputPrefix}>₹</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    placeholderTextColor="#B4BCC8"
                                    value={formData.monthly_salary}
                                    onChangeText={(text) => setFormData({ ...formData, monthly_salary: text })}
                                    keyboardType="numeric"
                                />
                            </View>

                            <TouchableOpacity
                                style={styles.submitButtonWrap}
                                activeOpacity={0.9}
                                onPress={handleEditStaff}
                            >
                                <LinearGradient
                                    colors={['#34D399', '#059669']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.submitButton}
                                >
                                    <Text style={styles.submitButtonText}>Update Staff</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <View style={{ height: 12 }} />
                        </ScrollView>
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
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Pay Salary</Text>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setPaymentModalVisible(false)}
                            >
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.paymentInfoCard}>
                            <View style={styles.paymentInfoRow}>
                                <Text style={styles.paymentInfoLabel}>Staff</Text>
                                <Text style={styles.paymentInfoValue}>{staff.name}</Text>
                            </View>
                            <View style={styles.paymentInfoDivider} />
                            <View style={styles.paymentInfoRow}>
                                <Text style={styles.paymentInfoLabel}>Month</Text>
                                <Text style={styles.paymentInfoValue}>{new Date().toISOString().slice(0, 7)}</Text>
                            </View>
                        </View>

                        <Text style={styles.inputLabel}>Amount</Text>
                        <View style={styles.inputWrap}>
                            <Text style={styles.inputPrefix}>₹</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0"
                                placeholderTextColor="#B4BCC8"
                                value={paymentAmount}
                                onChangeText={setPaymentAmount}
                                keyboardType="numeric"
                            />
                        </View>

                        <Text style={styles.inputLabel}>Notes</Text>
                        <View style={styles.inputWrap}>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Optional"
                                placeholderTextColor="#B4BCC8"
                                value={paymentNotes}
                                onChangeText={setPaymentNotes}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.submitButtonWrap}
                            activeOpacity={0.9}
                            onPress={handlePaySalary}
                        >
                            <LinearGradient
                                colors={['#34D399', '#059669']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.submitButton}
                            >
                                <Text style={styles.submitButtonText}>Mark as Paid</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F6F7FB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F6F7FB',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#F6F7FB',
    },
    errorText: {
        fontSize: 16,
        color: '#EF4444',
        fontWeight: '600',
    },
    header: {
        alignItems: 'center',
        paddingTop: 36,
        paddingBottom: 28,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
    },
    avatarRing: {
        width: 92,
        height: 92,
        borderRadius: 46,
        backgroundColor: 'rgba(255,255,255,0.18)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    avatarLarge: {
        width: 78,
        height: 78,
        borderRadius: 39,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLargeText: {
        color: '#059669',
        fontSize: 30,
        fontWeight: '800',
    },
    name: {
        fontSize: 23,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    rolePill: {
        backgroundColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 20,
        marginBottom: 22,
    },
    role: {
        fontSize: 13,
        color: '#ECFDF5',
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    headerStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        width: '100%',
    },
    headerStat: {
        flex: 1,
        alignItems: 'center',
    },
    headerStatDivider: {
        width: 1,
        height: 28,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    headerStatValue: {
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    headerStatLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.75)',
        marginTop: 3,
        letterSpacing: 0.6,
    },
    section: {
        backgroundColor: '#FFFFFF',
        marginTop: 14,
        padding: 18,
        marginHorizontal: 16,
        borderRadius: 20,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.04)',
    },
    sectionEyebrow: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        letterSpacing: 0.8,
        marginBottom: 14,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 0,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    detailIconChip: {
        width: 34,
        height: 34,
        borderRadius: 11,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    detailTextWrap: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 11.5,
        color: '#94A3B8',
        fontWeight: '600',
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 15,
        color: '#0B1120',
        fontWeight: '600',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    paidBadge: {
        backgroundColor: '#ECFDF5',
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
        backgroundColor: '#059669',
    },
    pendingDot: {
        backgroundColor: '#D97706',
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    paidBadgeText: {
        color: '#059669',
    },
    pendingBadgeText: {
        color: '#D97706',
    },
    paymentDetails: {
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderRadius: 14,
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#EEF1F6',
    },
    paymentDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    paymentDetailLabel: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '600',
    },
    paymentDetailValue: {
        fontSize: 13.5,
        color: '#0B1120',
        fontWeight: '700',
    },
    payButtonWrap: {
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 14,
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 4,
    },
    payButton: {
        flexDirection: 'row',
        padding: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payButtonText: {
        color: '#fff',
        fontSize: 15.5,
        fontWeight: '700',
        marginLeft: 8,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F3F8',
    },
    historyIconChip: {
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    historyLeft: {
        flex: 1,
    },
    historyMonth: {
        fontSize: 14.5,
        fontWeight: '700',
        color: '#0B1120',
        marginBottom: 2,
    },
    historyNotes: {
        fontSize: 12,
        color: '#94A3B8',
    },
    historyRight: {
        alignItems: 'flex-end',
    },
    historyAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#059669',
        marginBottom: 2,
    },
    historyDate: {
        fontSize: 11.5,
        color: '#94A3B8',
    },
    emptyHistory: {
        alignItems: 'center',
        paddingVertical: 28,
    },
    emptyHistoryText: {
        fontSize: 13.5,
        color: '#94A3B8',
        marginTop: 8,
        fontWeight: '500',
    },
    editButton: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        margin: 16,
        marginTop: 20,
        borderWidth: 1.5,
        borderColor: '#D1FAE5',
    },
    editButtonText: {
        color: '#059669',
        fontSize: 15.5,
        fontWeight: '700',
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(11,17,32,0.55)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 32 : 24,
        maxHeight: '88%',
    },
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
        marginBottom: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0B1120',
        letterSpacing: -0.3,
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 6,
        marginLeft: 2,
        letterSpacing: 0.2,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E5E9F0',
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        marginBottom: 14,
        paddingHorizontal: 14,
    },
    inputIcon: {
        marginRight: 8,
    },
    inputPrefix: {
        fontSize: 16,
        fontWeight: '700',
        color: '#94A3B8',
        marginRight: 6,
    },
    input: {
        flex: 1,
        paddingVertical: 13,
        fontSize: 15.5,
        color: '#0B1120',
        fontWeight: '500',
    },
    textArea: {
        height: 76,
        textAlignVertical: 'top',
        paddingTop: 13,
    },
    submitButtonWrap: {
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 6,
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 4,
    },
    submitButton: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    paymentInfoCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 14,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#EEF1F6',
    },
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
    paymentInfoLabel: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '600',
    },
    paymentInfoValue: {
        fontSize: 14,
        color: '#0B1120',
        fontWeight: '700',
    },
});

export default StaffProfileScreen;