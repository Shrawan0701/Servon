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
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => navigateToProfile(item)}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                        <LinearGradient
                            colors={['#34D399', '#059669']}
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
                            <Ionicons name="call-outline" size={14} color="#059669" />
                        </View>
                        <LocalizedText style={styles.detailText}>{item.phone}</LocalizedText>
                    </View>
                    <View style={styles.detailRow}>
                        <View style={styles.detailIconChip}>
                            <Ionicons name="calendar-outline" size={14} color="#059669" />
                        </View>
                        <LocalizedText style={styles.detailText}>Joined {item.joining_date}</LocalizedText>
                    </View>
                    <View style={styles.detailRow}>
                        <View style={styles.detailIconChip}>
                            <Ionicons name="cash-outline" size={14} color="#059669" />
                        </View>
                        <LocalizedText style={styles.detailText}>₹{item.monthly_salary.toLocaleString()} / mo</LocalizedText>
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
                        <Ionicons name="create-outline" size={16} color="#059669" />
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
                <ActivityIndicator size="large" color="#059669" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={localizeText("Search by name, role, or phone...", language)}
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => handleSearch('')}
                            style={styles.clearButton}
                        >
                            <Ionicons name="close-circle" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
                <LocalizedText style={styles.searchResultText}>
                    {filteredStaff.length} {filteredStaff.length === 1 ? 'staff member' : 'staff members'}
                </LocalizedText>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />
                }
            >
                {/* Stats Section */}
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <View style={[styles.statIconChip, { backgroundColor: '#ECFDF5' }]}>
                            <Ionicons name="people-outline" size={18} color="#059669" />
                        </View>
                        <LocalizedText style={styles.statNumber}>{stats.total_staff}</LocalizedText>
                        <LocalizedText translate style={styles.statLabel}>TOTAL STAFF</LocalizedText>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCard}>
                        <View style={[styles.statIconChip, { backgroundColor: '#ECFDF5' }]}>
                            <Ionicons name="checkmark-circle-outline" size={18} color="#059669" />
                        </View>
                        <LocalizedText style={[styles.statNumber, styles.paidStat]}>
                            {stats.paid_this_month}
                        </LocalizedText>
                        <LocalizedText translate style={styles.statLabel}>PAID</LocalizedText>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCard}>
                        <View style={[styles.statIconChip, { backgroundColor: '#FFFBEB' }]}>
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
                                        <Ionicons name="search-outline" size={48} color="#94A3B8" />
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
                                        <Ionicons name="people-outline" size={48} color="#059669" />
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
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Add Staff FAB */}
            <TouchableOpacity style={styles.fabWrap} activeOpacity={0.85} onPress={handleAddStaff}>
                <LinearGradient
                    colors={['#34D399', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.fab}
                >
                    <Ionicons name="add" size={28} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>

            {/* Add/Edit Staff Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
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

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <LocalizedText translate style={styles.inputLabel}>Full Name</LocalizedText>
                            <View style={styles.inputWrap}>
                                <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
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
                                <Ionicons name="call-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
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
                                <Ionicons name="briefcase-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
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
                                <Ionicons name="calendar-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
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

                            <TouchableOpacity
                                style={styles.submitButtonWrap}
                                activeOpacity={0.9}
                                onPress={handleSubmitStaff}
                            >
                                <LinearGradient
                                    colors={['#34D399', '#059669']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.submitButton}
                                >
                                    <LocalizedText style={styles.submitButtonText}>
                                        {editingStaff ? 'Update Staff' : 'Add Staff'}
                                    </LocalizedText>
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
                            <LocalizedText translate style={styles.modalTitle}>Pay Salary</LocalizedText>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setPaymentModalVisible(false)}
                            >
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

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

                        <TouchableOpacity
                            style={styles.submitButtonWrap}
                            activeOpacity={0.9}
                            onPress={handleSubmitPayment}
                        >
                            <LinearGradient
                                colors={['#34D399', '#059669']}
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
                            <LocalizedText style={{ fontWeight: '700', color: '#0B1120' }}>
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
    searchContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: '#E5E9F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0B1120',
        marginLeft: 10,
        fontWeight: '500',
    },
    clearButton: {
        padding: 4,
    },
    searchResultText: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 8,
        marginLeft: 4,
        fontWeight: '500',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FFFFFF',
        margin: 16,
        marginBottom: 8,
        borderRadius: 20,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.04)',
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: 44,
        backgroundColor: '#EEF1F6',
        marginHorizontal: 4,
    },
    statIconChip: {
        width: 34,
        height: 34,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statNumber: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0B1120',
        letterSpacing: -0.5,
    },
    paidStat: {
        color: '#059669',
    },
    pendingStat: {
        color: '#D97706',
    },
    statLabel: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 4,
        fontWeight: '700',
        letterSpacing: 0.6,
    },
    listContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 20,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        marginBottom: 14,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.04)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    avatarRing: {
        width: 46,
        height: 46,
        borderRadius: 23,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#059669',
        fontSize: 16,
        fontWeight: '800',
    },
    cardHeaderText: {
        flex: 1,
    },
    cardName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0B1120',
        letterSpacing: -0.2,
    },
    cardRole: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 1,
        fontWeight: '500',
    },
    paymentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
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
    paymentBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    paidBadgeText: {
        color: '#059669',
    },
    pendingBadgeText: {
        color: '#D97706',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F3F8',
        marginVertical: 14,
    },
    cardDetails: {
        marginBottom: 4,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    detailIconChip: {
        width: 26,
        height: 26,
        borderRadius: 9,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    detailText: {
        fontSize: 13.5,
        color: '#475569',
        fontWeight: '500',
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 10,
        gap: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 13,
        paddingVertical: 8,
        borderRadius: 10,
        minWidth: 60,
        justifyContent: 'center',
    },
    payButton: {
        backgroundColor: '#059669',
    },
    payButtonText: {
        color: '#fff',
        fontSize: 12.5,
        fontWeight: '700',
        marginLeft: 5,
    },
    editButton: {
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#D1FAE5',
    },
    editButtonText: {
        color: '#059669',
        fontSize: 12.5,
        fontWeight: '700',
        marginLeft: 5,
    },
    deleteButton: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    deleteButtonText: {
        color: '#EF4444',
        fontSize: 12.5,
        fontWeight: '700',
        marginLeft: 5,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 12.5,
        fontWeight: '700',
        marginLeft: 5,
    },
    fabWrap: {
        position: 'absolute',
        right: 22,
        bottom: 24,
        borderRadius: 30,
        shadowColor: '#059669',
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
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 32,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.04)',
    },
    emptyIconWrap: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0B1120',
    },
    emptySubtext: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 6,
        textAlign: 'center',
        lineHeight: 18,
    },
    emptyButton: {
        flexDirection: 'row',
        marginTop: 20,
        backgroundColor: '#059669',
        paddingHorizontal: 20,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: 14.5,
        fontWeight: '700',
        marginLeft: 6,
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
    confirmOverlay: {
        flex: 1,
        backgroundColor: 'rgba(11,17,32,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    confirmCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 24,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
    },
    confirmIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    confirmTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0B1120',
        marginBottom: 8,
        textAlign: 'center',
    },
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
    confirmButton: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmCancelButton: {
        backgroundColor: '#F1F5F9',
    },
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