import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text as NativeText,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    Platform,
    useWindowDimensions,
} from "react-native";
import LocalizedText, { localizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import {
    getStaff,
    createStaff,
    updateStaff,
    deleteStaff,
    markSalaryPaid
} from '../api';

const StaffScreen = ({ navigation }) => {
    const { language } = useLocale();
    const { width } = useWindowDimensions();
    const wideLayout = width >= 1000;
    const compactLayout = width < 600;
    const [staff, setStaff] = useState([]);
    const [filteredStaff, setFilteredStaff] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({
        total_staff: 0,
        paid_this_month: 0,
        pending_payment: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        role: '',
        joining_date: '',
        monthly_salary: '',
    });
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [staffPendingDelete, setStaffPendingDelete] = useState(null);

    const loadStaff = async () => {
        try {
            setLoading(true);
            const response = await getStaff();
            setStaff(response.data.staff || []);
            setFilteredStaff(response.data.staff || []);
            setStats(response.data.stats || {
                total_staff: 0,
                paid_this_month: 0,
                pending_payment: 0,
            });
        } catch (error) {
            console.error('Error loading staff:', error);
            Alert.alert('Error', 'Failed to load staff members');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadStaff();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadStaff();
        setRefreshing(false);
    };

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query.trim() === '') {
            setFilteredStaff(staff);
        } else {
            const filtered = staff.filter(item =>
                item.name.toLowerCase().includes(query.toLowerCase()) ||
                item.role.toLowerCase().includes(query.toLowerCase()) ||
                item.phone.includes(query)
            );
            setFilteredStaff(filtered);
        }
    };

    const handleAddStaff = () => {
        setEditingStaff(null);
        setFormData({
            name: '',
            phone: '',
            role: '',
            joining_date: new Date().toISOString().split('T')[0],
            monthly_salary: '',
        });
        setModalVisible(true);
    };

    const handleEditStaff = (staffMember) => {
        setEditingStaff(staffMember);
        setFormData({
            name: staffMember.name,
            phone: staffMember.phone,
            role: staffMember.role,
            joining_date: staffMember.joining_date,
            monthly_salary: staffMember.monthly_salary.toString(),
        });
        setModalVisible(true);
    };

    const handleSubmitStaff = async () => {
        try {
            const data = {
                ...formData,
                monthly_salary: parseFloat(formData.monthly_salary),
            };

            if (editingStaff) {
                await updateStaff(editingStaff.id, data);
                Alert.alert('Success', 'Staff member updated successfully');
            } else {
                await createStaff(data);
                Alert.alert('Success', 'Staff member added successfully');
            }

            setModalVisible(false);
            loadStaff();
        } catch (error) {
            console.error('Error saving staff:', error);
            Alert.alert('Error', 'Failed to save staff member');
        }
    };

    const handleDeleteStaff = (staffMember) => {
        setStaffPendingDelete(staffMember);
        setDeleteConfirmVisible(true);
    };

    const confirmDeleteStaff = async () => {
        if (!staffPendingDelete) return;
        const staffMember = staffPendingDelete;
        try {
            setDeletingId(staffMember.id);
            await deleteStaff(staffMember.id);
            setDeleteConfirmVisible(false);
            setStaffPendingDelete(null);
            Alert.alert('Success', `${staffMember.name} has been deleted`);
            setStaff(prev => prev.filter(s => s.id !== staffMember.id));
            await loadStaff();
        } catch (error) {
            console.error('Error deleting staff:', error);
            setDeleteConfirmVisible(false);
            Alert.alert(
                'Error',
                error.response?.data?.error ||
                error.response?.data?.details ||
                error.message ||
                'Failed to delete staff member'
            );
        } finally {
            setDeletingId(null);
        }
    };

    const handlePaySalary = (staffMember) => {
        setSelectedStaff(staffMember);
        setPaymentAmount(staffMember.monthly_salary.toString());
        setPaymentNotes('');
        setPaymentModalVisible(true);
    };

    const handleSubmitPayment = async () => {
        try {
            await markSalaryPaid(
                selectedStaff.id,
                parseFloat(paymentAmount),
                paymentNotes
            );
            Alert.alert('Success', 'Salary marked as paid');
            setPaymentModalVisible(false);
            loadStaff();
        } catch (error) {
            console.error('Error marking salary:', error);
            Alert.alert('Error', 'Failed to mark salary as paid');
        }
    };

    const navigateToProfile = (staffMember) => {
        navigation.navigate('StaffProfile', { staffId: staffMember.id });
    };

    const renderStaffCard = (item) => {
        const isDeleting = deletingId === item.id;
        return (
            <TouchableOpacity
                key={item.id}
                style={[styles.card, { width: wideLayout ? '49.3%' : '100%' }]}
                activeOpacity={0.85}
                onPress={() => navigateToProfile(item)}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                        <LinearGradient
                            colors={['#EAF2EC', '#EAF2EC']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.avatarRing}
                        >
                            <View style={styles.avatar}>
                                <LocalizedText style={styles.avatarText}>
                                    {item.name.charAt(0).toUpperCase()}
                                </LocalizedText>
                            </View>
                        </LinearGradient>
                        <View style={styles.cardHeaderText}>
                            <LocalizedText style={styles.cardName} numberOfLines={1}>{item.name}</LocalizedText>
                            <LocalizedText style={styles.cardRole}>{item.role}</LocalizedText>
                        </View>
                    </View>
                    <View style={[
                        styles.paymentBadge,
                        item.salary_paid_current_month ? styles.paidBadge : styles.pendingBadge
                    ]}>
                        <View style={[
                            styles.statusDot,
                            item.salary_paid_current_month ? styles.paidDot : styles.pendingDot
                        ]} />
                        <LocalizedText style={[
                            styles.paymentBadgeText,
                            item.salary_paid_current_month ? styles.paidBadgeText : styles.pendingBadgeText
                        ]}>
                            {item.salary_paid_current_month ? 'Paid' : 'Pending'}
                        </LocalizedText>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                        <View style={styles.detailIconChip}>
                            <Ionicons name="call-outline" size={14} color="#39805A" />
                        </View>
                        <LocalizedText style={styles.detailText}>{item.phone}</LocalizedText>
                    </View>
                    <View style={styles.detailRow}>
                        <View style={styles.detailIconChip}>
                            <Ionicons name="calendar-outline" size={14} color="#39805A" />
                        </View>
                        <LocalizedText style={styles.detailText}>Joined {item.joining_date && Number.isFinite(new Date(item.joining_date).getTime()) ? new Date(item.joining_date).toLocaleDateString(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : item.joining_date}</LocalizedText>
                    </View>
                    <View style={[styles.detailRow, styles.salaryRow]}>
                        <View style={styles.detailIconChip}>
                            <Ionicons name="cash-outline" size={14} color="#39805A" />
                        </View>
                        <LocalizedText style={[styles.detailText, styles.salaryText]}>₹{item.monthly_salary.toLocaleString()} / mo</LocalizedText>
                    </View>
                </View>

                <View style={styles.cardActions}>
                    {!item.salary_paid_current_month && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.payButton]}
                            activeOpacity={0.8}
                            onPress={(e) => {
                                e.stopPropagation();
                                handlePaySalary(item);
                            }}
                        >
                            <Ionicons name="cash-outline" size={16} color="#fff" />
                            <LocalizedText translate style={styles.actionButtonText}>Pay</LocalizedText>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.actionButton, styles.editButton]}
                        activeOpacity={0.8}
                        onPress={(e) => {
                            e.stopPropagation();
                            handleEditStaff(item);
                        }}
                    >
                        <Ionicons name="create-outline" size={16} color="#39805A" />
                        <LocalizedText translate style={styles.editButtonText}>Edit</LocalizedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        activeOpacity={0.8}
                        disabled={isDeleting}
                        onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteStaff(item);
                        }}
                    >
                        {isDeleting ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                            <>
                                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                <LocalizedText translate style={styles.deleteButtonText}>Remove</LocalizedText>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#39805A" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.toolbar}>
                <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={20} color="#7B897F" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={localizeText("Search by name, role, or phone...", language)}
                        placeholderTextColor="#7B897F"
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => handleSearch('')}
                            style={styles.clearButton}
                        >
                            <Ionicons name="close-circle" size={20} color="#7B897F" />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity style={styles.addButton} activeOpacity={0.85} onPress={handleAddStaff}>
                    <Ionicons name="add" size={21} color="#fff" />
                    <LocalizedText translate style={styles.addButtonText}>Add Staff</LocalizedText>
                </TouchableOpacity>
                </View>
                <LocalizedText style={styles.searchResultText}>
                    {filteredStaff.length} {filteredStaff.length === 1 ? 'staff member' : 'staff members'}
                </LocalizedText>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#39805A" />
                }
            >
                {/* Stats Section */}
                <View style={[styles.statsContainer, compactLayout && styles.statsCompact]}>
                    <View style={styles.statCard}>
                        <View style={[styles.statIconChip, { backgroundColor: '#EAF2EC' }, compactLayout && { display: 'none' }]}>
                            <Ionicons name="people-outline" size={18} color="#39805A" />
                        </View>
                        <LocalizedText style={styles.statNumber}>{stats.total_staff}</LocalizedText>
                        <LocalizedText translate style={styles.statLabel}>TOTAL STAFF</LocalizedText>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCard}>
                        <View style={[styles.statIconChip, { backgroundColor: '#EAF2EC' }, compactLayout && { display: 'none' }]}>
                            <Ionicons name="checkmark-circle-outline" size={18} color="#39805A" />
                        </View>
                        <LocalizedText style={[styles.statNumber, styles.paidStat]}>
                            {stats.paid_this_month}
                        </LocalizedText>
                        <LocalizedText translate style={styles.statLabel}>PAID</LocalizedText>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCard}>
                        <View style={[styles.statIconChip, { backgroundColor: '#FFFBEB' }, compactLayout && { display: 'none' }]}>
                            <Ionicons name="time-outline" size={18} color="#F59E0B" />
                        </View>
                        <LocalizedText style={[styles.statNumber, styles.pendingStat]}>
                            {stats.pending_payment}
                        </LocalizedText>
                        <LocalizedText translate style={styles.statLabel}>PENDING</LocalizedText>
                    </View>
                </View>

                {/* Staff List */}
                <View style={styles.listContainer}>
                    {filteredStaff.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            {searchQuery.length > 0 ? (
                                <>
                                    <View style={styles.emptyIconWrap}>
                                        <Ionicons name="search-outline" size={48} color="#7B897F" />
                                    </View>
                                    <LocalizedText translate style={styles.emptyText}>No results found</LocalizedText>
                                    <LocalizedText translate style={styles.emptySubtext}>
                                        Try adjusting your search terms
                                    </LocalizedText>
                                    <TouchableOpacity
                                        style={styles.emptyButton}
                                        activeOpacity={0.85}
                                        onPress={() => handleSearch('')}
                                    >
                                        <LocalizedText translate style={styles.emptyButtonText}>Clear Search</LocalizedText>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <View style={styles.emptyIconWrap}>
                                        <Ionicons name="people-outline" size={48} color="#39805A" />
                                    </View>
                                    <LocalizedText translate style={styles.emptyText}>No staff members yet</LocalizedText>
                                    <LocalizedText translate style={styles.emptySubtext}>
                                        Add your team to start tracking attendance and payroll
                                    </LocalizedText>
                                    <TouchableOpacity
                                        style={styles.emptyButton}
                                        activeOpacity={0.85}
                                        onPress={handleAddStaff}
                                    >
                                        <Ionicons name="add" size={18} color="#fff" />
                                        <LocalizedText translate style={styles.emptyButtonText}>
                                            Add Your First Staff Member
                                        </LocalizedText>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    ) : (
                        filteredStaff.map(renderStaffCard)
                    )}
                </View>
                <View style={{ height: 24 }} />
            </ScrollView>

            {/* Add/Edit Staff Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={[styles.modalOverlay, compactLayout && styles.modalOverlayCompact]}>
                    <View style={[styles.modalContent, compactLayout && styles.modalContentCompact]}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <LocalizedText style={styles.modalTitle}>
                                {editingStaff ? 'Edit Staff' : 'Add Staff'}
                            </LocalizedText>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setModalVisible(false)}
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
                                    placeholder={localizeText("e.g. Rahul Sharma", language)}
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
                                    placeholder="10-digit number"
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
                                    placeholder={localizeText("e.g. Chef, Waiter", language)}
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
                                onPress={handleSubmitStaff}
                            >
                                <LinearGradient
                                    colors={['#2E503C', '#2E503C']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.submitButton}
                                >
                                    <LocalizedText style={styles.submitButtonText}>
                                        {editingStaff ? 'Update Staff' : 'Add Staff'}
                                    </LocalizedText>
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
                                <LocalizedText style={styles.paymentInfoValue}>{selectedStaff?.name}</LocalizedText>
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
                            onPress={handleSubmitPayment}
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

            {/* Delete Confirmation Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={deleteConfirmVisible}
                onRequestClose={() => {
                    setDeleteConfirmVisible(false);
                    setStaffPendingDelete(null);
                }}
            >
                <View style={styles.confirmOverlay}>
                    <View style={styles.confirmCard}>
                        <View style={styles.confirmIconWrap}>
                            <Ionicons name="trash-outline" size={26} color="#EF4444" />
                        </View>
                        <LocalizedText translate style={styles.confirmTitle}>Delete Staff Member</LocalizedText>
                        <LocalizedText style={styles.confirmMessage}>
                            Are you sure you want to delete{' '}
                            <LocalizedText style={{ fontWeight: '700', color: '#20332A' }}>
                                {staffPendingDelete?.name}
                            </LocalizedText>
                            ? This can't be undone.
                        </LocalizedText>
                        <View style={styles.confirmActions}>
                            <TouchableOpacity
                                style={[styles.confirmButton, styles.confirmCancelButton]}
                                activeOpacity={0.8}
                                disabled={deletingId !== null}
                                onPress={() => {
                                    setDeleteConfirmVisible(false);
                                    setStaffPendingDelete(null);
                                }}
                            >
                                <LocalizedText translate style={styles.confirmCancelText}>Cancel</LocalizedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmButton, styles.confirmDeleteButton]}
                                activeOpacity={0.8}
                                disabled={deletingId !== null}
                                onPress={confirmDeleteStaff}
                            >
                                {deletingId !== null ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <LocalizedText translate style={styles.confirmDeleteText}>Delete</LocalizedText>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2E503C', minHeight: 48, paddingHorizontal: 16, borderRadius: 10 },
    addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    scrollContent: { width: '100%', maxWidth: 1320, alignSelf: 'center' },
    statsCompact: { paddingVertical: 10, paddingHorizontal: 0 },
    salaryRow: { marginTop: 4, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F3F5F2' },
    salaryText: { fontSize: 17, fontWeight: '600', color: '#20332A' },
    modalOverlayCompact: { justifyContent: 'flex-end', padding: 0 },
    modalContentCompact: { maxWidth: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: Platform.OS === 'ios' ? 32 : 20 },
    formScroll: { flexShrink: 1 },

    container: { flex: 1, backgroundColor: '#F3F5F2' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F5F2' },
    searchContainer: { width: '100%', maxWidth: 1320, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 12 },
    searchBar: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 14, minHeight: 48, borderWidth: 1, borderColor: '#DFE5DF' },
    searchInput: { flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 14, color: '#20332A', marginLeft: 10, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
    clearButton: {
        padding: 4,
    },
    searchResultText: { fontSize: 12, color: '#627166', marginTop: 12, fontWeight: '500' },
    statsContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 6, backgroundColor: '#FFFFFF', marginHorizontal: 20, marginTop: 4, marginBottom: 20, borderRadius: 12, borderWidth: 1, borderColor: '#DFE5DF' },
    statCard: { flex: 1, minWidth: 0, paddingHorizontal: 18, paddingVertical: 4, minHeight: 76, justifyContent: 'center' },
    statDivider: { width: 1, height: 46, backgroundColor: '#DFE5DF' },
    statIconChip: { position: 'absolute', right: 18, top: 6, width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
    statNumber: { fontSize: 28, fontWeight: '700', color: '#20332A', letterSpacing: -0.6 },
    paidStat: {
        color: '#39805A',
    },
    pendingStat: {
        color: '#D97706',
    },
    statLabel: { fontSize: 10, color: '#627166', marginTop: 7, fontWeight: '600' },
    listContainer: { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', rowGap: 16, paddingBottom: 16 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#DFE5DF' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
    avatarRing: { width: 46, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatar: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EAF2EC', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#2E503C', fontSize: 19, fontWeight: '700' },
    cardHeaderText: {
        flex: 1,
    },
    cardName: { fontSize: 17, fontWeight: '700', color: '#20332A', letterSpacing: -0.2 },
    cardRole: { fontSize: 13, color: '#627166', marginTop: 4 },
    paymentBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, flexShrink: 0 },
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
    paymentBadgeText: { fontSize: 12, fontWeight: '600' },
    paidBadgeText: {
        color: '#39805A',
    },
    pendingBadgeText: {
        color: '#D97706',
    },
    divider: { height: 1, backgroundColor: '#E8EDE8', marginVertical: 16 },
    cardDetails: { gap: 10 },
    detailRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
    detailIconChip: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F3F5F2', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    detailText: { fontSize: 13, color: '#627166', lineHeight: 20, flexShrink: 1 },
    cardActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', paddingTop: 16, marginTop: 16, borderTopWidth: 1, borderTopColor: '#E8EDE8', gap: 8 },
    actionButton: { flexDirection: 'row', alignItems: 'center', minHeight: 42, paddingHorizontal: 14, borderRadius: 8, minWidth: 78, justifyContent: 'center' },
    payButton: { backgroundColor: '#2E503C' },
    payButtonText: {
        color: '#fff',
        fontSize: 12.5,
        fontWeight: '700',
        marginLeft: 5,
    },
    editButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFE5DF' },
    editButtonText: { color: '#2E503C', fontSize: 13, fontWeight: '600', marginLeft: 6 },
    deleteButton: { backgroundColor: '#FDF3F2', borderWidth: 1, borderColor: '#F5E2DF' },
    deleteButtonText: { color: '#BB4B40', fontSize: 13, fontWeight: '600', marginLeft: 6 },
    actionButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', marginLeft: 6 },
    fabWrap: {
        position: 'absolute',
        right: 22,
        bottom: 24,
        borderRadius: 30,
        shadowColor: '#39805A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 6,
    },
    fab: {
        width: 58,
        height: 58,
        borderRadius: 29,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(23,38,30,0.48)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { width: '100%', maxWidth: 520, flexShrink: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, maxHeight: '92%' },
    modalHandle: { display: 'none' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 18, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#DFE5DF' },
    modalTitle: { fontSize: 21, fontWeight: '700', color: '#20332A', letterSpacing: -0.4 },
    modalCloseBtn: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#F3F5F2', justifyContent: 'center', alignItems: 'center' },
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#405448', marginBottom: 8 },
    inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DFE5DF', borderRadius: 9, backgroundColor: '#FFFFFF', marginBottom: 18, paddingHorizontal: 12, minHeight: 46, flexShrink: 0 },
    inputIcon: {
        marginRight: 8,
    },
    inputPrefix: { fontSize: 16, fontWeight: '600', color: '#627166', marginRight: 6 },
    input: { flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 15, color: '#20332A', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
    textArea: {
        height: 76,
        textAlignVertical: 'top',
        paddingTop: 13,
    },
    submitButtonWrap: { borderRadius: 10, overflow: 'hidden', marginTop: 10, flexShrink: 0 },
    submitButton: { minHeight: 48, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
    submitButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    emptyContainer: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#DFE5DF' },
    emptyIconWrap: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#EAF2EC', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    emptyText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#20332A',
    },
    emptySubtext: { fontSize: 13, color: '#627166', marginTop: 8, textAlign: 'center', lineHeight: 21 },
    emptyButton: { flexDirection: 'row', marginTop: 22, backgroundColor: '#2E503C', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 9, alignItems: 'center' },
    emptyButtonText: {
        color: '#fff',
        fontSize: 14.5,
        fontWeight: '700',
        marginLeft: 6,
    },
    paymentInfoCard: { backgroundColor: '#F3F5F2', borderRadius: 10, padding: 14, marginBottom: 22, borderWidth: 1, borderColor: '#DFE5DF' },
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
    paymentInfoLabel: { fontSize: 13, color: '#627166' },
    paymentInfoValue: { fontSize: 14, color: '#20332A', fontWeight: '600', flexShrink: 1, marginLeft: 16 },
    confirmOverlay: {
        flex: 1,
        backgroundColor: 'rgba(11,17,32,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    confirmCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' },
    confirmIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    confirmTitle: { fontSize: 18, fontWeight: '700', color: '#20332A', marginBottom: 10, textAlign: 'center' },
    confirmMessage: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 22,
    },
    confirmActions: {
        flexDirection: 'row',
        width: '100%',
        gap: 10,
    },
    confirmButton: { flex: 1, paddingVertical: 14, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    confirmCancelButton: { backgroundColor: '#F3F5F2' },
    confirmCancelText: {
        color: '#475569',
        fontSize: 14.5,
        fontWeight: '700',
    },
    confirmDeleteButton: {
        backgroundColor: '#EF4444',
    },
    confirmDeleteText: {
        color: '#fff',
        fontSize: 14.5,
        fontWeight: '700',
    },
});

export default StaffScreen;
