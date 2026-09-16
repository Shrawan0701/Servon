// src/screens/web/Admin.js

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    adminLogin,
    adminGetBusinesses,
    adminCreateBusiness,
    adminUpdateBusiness,
    adminDeleteBusiness,
} from '../../api';

// ─── ADMIN LOGIN COMPONENT ──────────────────────────────────────────────────
function AdminLogin({ onLoginSuccess }) {
    const [email, setEmail] = useState('admin@servon.cloud');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [focusedField, setFocusedField] = useState(null);
    const { width } = useWindowDimensions();
    const isMobile = width < 700;

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Please enter email and password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await adminLogin(email, password);

            if (response.data.success && response.data.token) {
                const fullToken = response.data.token.trim();
                localStorage.setItem('adminToken', fullToken);
                localStorage.setItem('adminData', JSON.stringify(response.data.admin));
                onLoginSuccess(response.data);
            } else {
                setError('Login failed: No token received');
            }
        } catch (err) {
            console.error('❌ Login error:', err);
            setError(err.response?.data?.error || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView
            style={loginStyles.page}
            contentContainerStyle={loginStyles.pageContent}
        >
            <View style={[loginStyles.container, isMobile && loginStyles.containerMobile]}>
                {/* Brand panel */}
                <View style={[loginStyles.brandPanel, isMobile && loginStyles.brandPanelMobile]}>
                    <View style={loginStyles.brandGlowTop} />
                    <View style={loginStyles.brandGlowBottom} />
                    <View style={loginStyles.brandNoisePanel} />

                    <View style={loginStyles.brandMark}>
                        <Ionicons name="restaurant" size={20} color="#fff" />
                    </View>
                    <Text style={loginStyles.brandTitle}>Servon</Text>
                    <Text style={loginStyles.brandTagline}>Control center for every restaurant on the platform</Text>

                    {!isMobile && (
                        <>
                            <View style={loginStyles.brandDivider} />
                            <View style={loginStyles.brandFeature}>
                                <View style={loginStyles.brandFeatureIcon}>
                                    <Ionicons name="storefront-outline" size={14} color="#fff" />
                                </View>
                                <Text style={loginStyles.brandFeatureText}>Manage restaurant accounts</Text>
                            </View>
                            <View style={loginStyles.brandFeature}>
                                <View style={loginStyles.brandFeatureIcon}>
                                    <Ionicons name="pulse-outline" size={14} color="#fff" />
                                </View>
                                <Text style={loginStyles.brandFeatureText}>Track subscriptions in real time</Text>
                            </View>
                            <View style={loginStyles.brandFeature}>
                                <View style={loginStyles.brandFeatureIcon}>
                                    <Ionicons name="shield-checkmark-outline" size={14} color="#fff" />
                                </View>
                                <Text style={loginStyles.brandFeatureText}>Secure, admin-only access</Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Form panel */}
                <View style={[loginStyles.formPanel, isMobile && loginStyles.formPanelMobile]}>
                    <Text style={loginStyles.title}>Welcome back</Text>
                    <Text style={loginStyles.subtitle}>Sign in with your admin credentials to continue</Text>

                    {error ? (
                        <View style={loginStyles.errorBox}>
                            <Ionicons name="alert-circle" size={16} color="#DC2626" />
                            <Text style={loginStyles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <View style={loginStyles.fieldGroup}>
                        <Text style={loginStyles.label}>Email</Text>
                        <View style={[loginStyles.inputWrap, focusedField === 'email' && loginStyles.inputWrapFocused]}>
                            <Ionicons name="mail-outline" size={16} color={focusedField === 'email' ? '#0A2E23' : '#9C9890'} style={loginStyles.inputIcon} />
                            <TextInput
                                style={loginStyles.input}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="admin@servon.cloud"
                                placeholderTextColor="#B7B2A6"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                            />
                        </View>
                    </View>

                    <View style={loginStyles.fieldGroup}>
                        <Text style={loginStyles.label}>Password</Text>
                        <View style={[loginStyles.inputWrap, focusedField === 'password' && loginStyles.inputWrapFocused]}>
                            <Ionicons name="lock-closed-outline" size={16} color={focusedField === 'password' ? '#0A2E23' : '#9C9890'} style={loginStyles.inputIcon} />
                            <TextInput
                                style={loginStyles.input}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Enter your password"
                                placeholderTextColor="#B7B2A6"
                                secureTextEntry
                                onSubmitEditing={handleLogin}
                                onFocus={() => setFocusedField('password')}
                                onBlur={() => setFocusedField(null)}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[loginStyles.loginBtn, loading && loginStyles.loginBtnDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Text style={loginStyles.loginBtnText}>Sign in</Text>
                                <Ionicons name="arrow-forward" size={16} color="#fff" />
                            </>
                        )}
                    </TouchableOpacity>

                    <Text style={loginStyles.footnote}>Restricted to authorized Servon administrators</Text>
                </View>
            </View>
        </ScrollView>
    );
}

const loginStyles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: '#F6F3EC',
    },
    pageContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        minHeight: '100%',
    },
    container: {
        flexDirection: 'row',
        width: '100%',
        maxWidth: 900,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#EDE8DC',
        shadowColor: '#0A2E23',
        shadowOffset: { width: 0, height: 30 },
        shadowOpacity: 0.14,
        shadowRadius: 60,
        elevation: 10,
    },
    containerMobile: {
        flexDirection: 'column',
        borderRadius: 22,
        maxWidth: 440,
    },
    brandPanel: {
        flexBasis: '44%',
        minWidth: 260,
        backgroundColor: '#0A2E23',
        padding: 44,
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
    },
    brandPanelMobile: {
        flexBasis: 'auto',
        minWidth: 0,
        padding: 30,
    },
    brandGlowTop: {
        position: 'absolute',
        top: -90,
        right: -90,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(201, 162, 39, 0.14)',
    },
    brandGlowBottom: {
        position: 'absolute',
        bottom: -110,
        left: -70,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(255,255,255,0.045)',
    },
    brandNoisePanel: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        margin: 14,
        borderRadius: 20,
    },
    brandMark: {
        width: 44,
        height: 44,
        borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
    },
    brandTitle: {
        fontSize: 26,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -0.8,
        marginBottom: 8,
    },
    brandTagline: {
        fontSize: 13.5,
        lineHeight: 21,
        color: 'rgba(255,255,255,0.7)',
        maxWidth: 260,
        letterSpacing: 0.1,
    },
    brandDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.12)',
        marginTop: 28,
        marginBottom: 24,
    },
    brandFeature: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        marginBottom: 15,
    },
    brandFeatureIcon: {
        width: 27,
        height: 27,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.09)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    brandFeatureText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '500',
        letterSpacing: 0.1,
    },
    formPanel: {
        flex: 1,
        minWidth: 280,
        padding: 48,
        justifyContent: 'center',
    },
    formPanelMobile: {
        minWidth: 0,
        padding: 28,
        paddingTop: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#14181C',
        marginBottom: 7,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13.5,
        color: '#797469',
        marginBottom: 26,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        backgroundColor: '#FDF2F2',
        borderRadius: 11,
        padding: 13,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#F7D6D6',
    },
    errorText: {
        color: '#C0362C',
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
    fieldGroup: {
        marginBottom: 17,
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: '#8A8578',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 7,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
        borderBottomWidth: 1.5,
        borderBottomColor: '#E7E2D6',
        borderRadius: 10,
        backgroundColor: '#F7F5EF',
        paddingHorizontal: 4,
    },
    inputWrapFocused: {
        backgroundColor: '#F1F6F3',
        borderBottomColor: '#0A2E23',
    },
    inputIcon: {
        marginLeft: 9,
        marginRight: 9,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 14,
        color: '#14181C',
        outlineStyle: 'none',
        minWidth: 0,
    },
    loginBtn: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: '#0A2E23',
        borderRadius: 13,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        shadowColor: '#0A2E23',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
        elevation: 3,
    },
    loginBtnDisabled: {
        opacity: 0.6,
    },
    loginBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
        letterSpacing: 0.2,
    },
    footnote: {
        fontSize: 12,
        color: '#ACA79A',
        textAlign: 'center',
        marginTop: 22,
    },
});

// ─── ADMIN DASHBOARD ────────────────────────────────────────────────────────

const STATUS_META = {
    ACTIVE: { bg: '#E9F8F1', text: '#0D7A4C', dot: '#17B26A' },
    TRIAL: { bg: '#EAF1FF', text: '#2953C4', dot: '#4C7EF3' },
    EXPIRED: { bg: '#FDF0EF', text: '#B4302A', dot: '#E5564C' },
    INACTIVE: { bg: '#F2F1ED', text: '#5F5B52', dot: '#A8A398' },
};

function getInitials(name = '') {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase() || '?';
}

function AdminDashboard() {
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingBusiness, setEditingBusiness] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [formData, setFormData] = useState({
        businessName: '',
        ownerName: '',
        email: '',
        phone: '',
        password: '',
        referralCode: '',
        subscription_status: 'TRIAL',
    });
    const [submitting, setSubmitting] = useState(false);
    const [focusedField, setFocusedField] = useState(null);
    const { width } = useWindowDimensions();
    const isMobile = width < 700;

    // Fetch businesses
    const fetchBusinesses = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const response = await adminGetBusinesses();
            setBusinesses(response.data.data || []);
        } catch (error) {
            console.error('Error fetching businesses:', error);
            Alert.alert('Error', 'Failed to load businesses');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchBusinesses();
    }, []);

    // Handle create/update business
    const handleSubmit = async () => {
        if (!formData.businessName || !formData.ownerName || !formData.email || !formData.phone) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        setSubmitting(true);
        try {
            let response;
            if (editingBusiness) {
                response = await adminUpdateBusiness(editingBusiness.id, {
                    business_name: formData.businessName,
                    owner_name: formData.ownerName,
                    email: formData.email,
                    phone: formData.phone,
                    subscription_status: formData.subscription_status || 'TRIAL',
                });
            } else {
                if (!formData.password) {
                    Alert.alert('Error', 'Password is required for new accounts');
                    setSubmitting(false);
                    return;
                }
                response = await adminCreateBusiness({
                    businessName: formData.businessName,
                    ownerName: formData.ownerName,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password,
                    referralCode: formData.referralCode || undefined,
                });
            }

            if (response.data.success) {
                Alert.alert('Success', editingBusiness ? 'Business updated successfully!' : 'Business created successfully!');
                closeModal();
                await fetchBusinesses(true);
                // Fetch again to ensure fresh data
                const freshResponse = await adminGetBusinesses();
                setBusinesses(freshResponse.data.data || []);
            }
        } catch (error) {
            console.error('❌ Submit error:', error);
            Alert.alert('Error', error.response?.data?.error || 'Operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle delete business
    const handleDelete = (business) => {
        console.log('🗑️ Delete clicked:', business.business_name);

        const confirmDelete = () => {
            console.log('🗑️ Confirmed delete for:', business.id);
            try {
                adminDeleteBusiness(business.id)
                    .then(() => {
                        console.log('✅ Deleted successfully');
                        fetchBusinesses(true);
                        Alert.alert('Success', 'Business deleted successfully');
                    })
                    .catch((error) => {
                        console.error('❌ Delete error:', error);
                        Alert.alert('Error', error.response?.data?.error || 'Failed to delete business');
                    });
            } catch (error) {
                console.error('❌ Delete error:', error);
                Alert.alert('Error', 'Failed to delete business');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Are you sure you want to delete "${business.business_name}"?`)) {
                confirmDelete();
            }
        } else {
            Alert.alert(
                'Delete Business',
                `Are you sure you want to delete "${business.business_name}"?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: confirmDelete },
                ]
            );
        }
    };

    // Open modal for create/edit
    const openModal = (business = null) => {
        if (business) {
            setEditingBusiness(business);
            setFormData({
                businessName: business.business_name || '',
                ownerName: business.owner_name || '',
                email: business.email || '',
                phone: business.phone || '',
                password: '',
                referralCode: '',
                subscription_status: business.subscription_status || 'TRIAL',
            });
        } else {
            setEditingBusiness(null);
            setFormData({
                businessName: '',
                ownerName: '',
                email: '',
                phone: '',
                password: '',
                referralCode: '',
                subscription_status: 'TRIAL',
            });
        }
        setShowCreateModal(true);
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setEditingBusiness(null);
        setFormData({
            businessName: '',
            ownerName: '',
            email: '',
            phone: '',
            password: '',
            referralCode: '',
            subscription_status: 'TRIAL',
        });
    };

    // Logout
    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminData');
        window.location.reload();
    };

    // Filtered list (search + status filter)
    const filteredBusinesses = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return businesses.filter((b) => {
            const matchesQuery =
                !q ||
                b.business_name?.toLowerCase().includes(q) ||
                b.owner_name?.toLowerCase().includes(q) ||
                b.email?.toLowerCase().includes(q);
            const matchesStatus =
                statusFilter === 'ALL' || (b.subscription_status || 'INACTIVE') === statusFilter;
            return matchesQuery && matchesStatus;
        });
    }, [businesses, searchQuery, statusFilter]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0A2E23" />
                <Text style={styles.loadingText}>Loading businesses...</Text>
            </View>
        );
    }

    const total = businesses.length;
    const active = businesses.filter(b => b.subscription_status === 'ACTIVE').length;
    const trial = businesses.filter(b => b.subscription_status === 'TRIAL').length;
    const inactive = total - active - trial;

    const statCardStyle = [
        styles.statCard,
        isMobile && styles.statCardMobile,
    ];

    const FILTER_CHIPS = ['ALL', 'ACTIVE', 'TRIAL', 'EXPIRED', 'INACTIVE'];

    return (
        <ScrollView
            style={styles.scrollRoot}
            contentContainerStyle={[styles.adminContainer, isMobile && styles.adminContainerMobile]}
            showsVerticalScrollIndicator={true}
        >
            {/* Admin Header */}
            <View style={styles.adminHeader}>
                <View style={styles.adminHeaderLeft}>
                    <View style={styles.headerEyebrow}>
                        <View style={styles.headerEyebrowDot} />
                        <Text style={styles.headerEyebrowText}>ADMIN PANEL</Text>
                    </View>
                    <Text style={[styles.adminTitle, isMobile && styles.adminTitleMobile]}>Restaurant Accounts</Text>
                    {!isMobile && (
                        <Text style={styles.adminSubtitle}>Create, update, and monitor every business on Servon</Text>
                    )}
                </View>
                <TouchableOpacity
                    style={styles.logoutBtn}
                    onPress={handleLogout}
                    activeOpacity={0.75}
                >
                    <Ionicons name="log-out-outline" size={18} color="#C0362C" />
                    {!isMobile && <Text style={styles.logoutBtnText}>Logout</Text>}
                </TouchableOpacity>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsGrid}>
                <View style={[...statCardStyle, { borderTopColor: '#17B26A' }]}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#E9F8F1' }]}>
                        <Ionicons name="storefront" size={18} color="#0D7A4C" />
                    </View>
                    <View>
                        <Text style={styles.statNumber}>{total}</Text>
                        <Text style={styles.statLabel}>Total Restaurants</Text>
                    </View>
                </View>
                <View style={[...statCardStyle, { borderTopColor: '#4C7EF3' }]}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#EAF1FF' }]}>
                        <Ionicons name="checkmark-circle" size={18} color="#2953C4" />
                    </View>
                    <View>
                        <Text style={styles.statNumber}>{active}</Text>
                        <Text style={styles.statLabel}>Active</Text>
                    </View>
                </View>
                <View style={[...statCardStyle, { borderTopColor: '#C9A227' }]}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#FBF3DE' }]}>
                        <Ionicons name="time" size={18} color="#96721B" />
                    </View>
                    <View>
                        <Text style={styles.statNumber}>{trial}</Text>
                        <Text style={styles.statLabel}>Trial</Text>
                    </View>
                </View>
                <View style={[...statCardStyle, { borderTopColor: '#E5564C' }]}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#FDF0EF' }]}>
                        <Ionicons name="close-circle" size={18} color="#B4302A" />
                    </View>
                    <View>
                        <Text style={styles.statNumber}>{inactive}</Text>
                        <Text style={styles.statLabel}>Inactive/Expired</Text>
                    </View>
                </View>
            </View>

            {/* Actions */}
            <View style={[styles.actionsRow, isMobile && styles.actionsRowMobile]}>
                <TouchableOpacity
                    style={[styles.createBtn, isMobile && styles.fullWidthBtn]}
                    onPress={() => openModal()}
                    activeOpacity={0.85}
                >
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.createBtnText}>Create Restaurant</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.refreshBtn, isMobile && styles.fullWidthBtn]}
                    onPress={() => fetchBusinesses(true)}
                    activeOpacity={0.75}
                >
                    {refreshing ? (
                        <ActivityIndicator size="small" color="#3F3B33" />
                    ) : (
                        <Ionicons name="refresh" size={18} color="#3F3B33" />
                    )}
                    <Text style={styles.refreshBtnText}>Refresh</Text>
                </TouchableOpacity>
            </View>

            {/* Search + filter bar */}
            <View style={[styles.toolbar, isMobile && styles.toolbarMobile]}>
                <View style={styles.searchWrap}>
                    <Ionicons name="search-outline" size={16} color="#9C9890" />
                    <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search by name, owner, or email"
                        placeholderTextColor="#B7B2A6"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                            <Ionicons name="close-circle" size={16} color="#B7B2A6" />
                        </TouchableOpacity>
                    )}
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                >
                    {FILTER_CHIPS.map((chip) => {
                        const isActive = statusFilter === chip;
                        return (
                            <TouchableOpacity
                                key={chip}
                                style={[styles.chip, isActive && styles.chipActive]}
                                onPress={() => setStatusFilter(chip)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                    {chip === 'ALL' ? 'All' : chip.charAt(0) + chip.slice(1).toLowerCase()}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Business list */}
            {filteredBusinesses.length === 0 ? (
                <View style={styles.tableContainer}>
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrap}>
                            <Ionicons
                                name={businesses.length === 0 ? 'storefront-outline' : 'search-outline'}
                                size={30}
                                color="#8A8578"
                            />
                        </View>
                        <Text style={styles.emptyTitle}>
                            {businesses.length === 0 ? 'No businesses yet' : 'No matches found'}
                        </Text>
                        <Text style={styles.emptyText}>
                            {businesses.length === 0
                                ? 'Create your first restaurant account to get started'
                                : 'Try a different search term or filter'}
                        </Text>
                        {businesses.length === 0 && (
                            <TouchableOpacity
                                style={styles.emptyCreateBtn}
                                onPress={() => openModal()}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="add" size={16} color="#fff" />
                                <Text style={styles.emptyCreateBtnText}>Create Restaurant</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ) : isMobile ? (
                // ── Card list (mobile) ──
                <View style={styles.cardList}>
                    {filteredBusinesses.map((biz) => {
                        const meta = STATUS_META[biz.subscription_status] || STATUS_META.INACTIVE;
                        return (
                            <View key={biz.id} style={styles.bizCard}>
                                <View style={styles.bizCardTop}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.bizCardName} numberOfLines={1}>{biz.business_name}</Text>
                                        <View style={styles.bizCardOwnerRow}>
                                            <View style={styles.avatarCircle}>
                                                <Text style={styles.avatarText}>{getInitials(biz.owner_name)}</Text>
                                            </View>
                                            <Text style={styles.bizCardOwner} numberOfLines={1}>{biz.owner_name}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                                        <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
                                        <Text style={[styles.statusText, { color: meta.text }]}>
                                            {biz.subscription_status || 'INACTIVE'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.bizCardDivider} />

                                <View style={styles.bizCardInfoRow}>
                                    <Ionicons name="mail-outline" size={13} color="#9C9890" />
                                    <Text style={styles.bizCardInfoText} numberOfLines={1}>{biz.email}</Text>
                                </View>
                                <View style={styles.bizCardInfoRow}>
                                    <Ionicons name="call-outline" size={13} color="#9C9890" />
                                    <Text style={styles.bizCardInfoText} numberOfLines={1}>{biz.phone}</Text>
                                </View>

                                <View style={styles.bizCardActions}>
                                    <TouchableOpacity
                                        style={[styles.bizCardActionBtn, { borderColor: '#CBDBFB', backgroundColor: '#F6F9FF' }]}
                                        onPress={() => openModal(biz)}
                                        activeOpacity={0.75}
                                    >
                                        <Ionicons name="create-outline" size={15} color="#2953C4" />
                                        <Text style={[styles.bizCardActionText, { color: '#2953C4' }]}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.bizCardActionBtn, { borderColor: '#F6CFCB', backgroundColor: '#FEF6F5' }]}
                                        onPress={() => handleDelete(biz)}
                                        activeOpacity={0.75}
                                    >
                                        <Ionicons name="trash-outline" size={15} color="#C0362C" />
                                        <Text style={[styles.bizCardActionText, { color: '#C0362C' }]}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>
            ) : (
                // ── Table (tablet / desktop) ──
                <View style={styles.tableContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.tableWrapper}>
                            {/* Header Row */}
                            <View style={[styles.tableRow, styles.tableHeaderRow]}>
                                <Text style={[styles.tableCell, styles.headerCell, { minWidth: 220 }]}>Business Name</Text>
                                <Text style={[styles.tableCell, styles.headerCell, { minWidth: 150 }]}>Owner</Text>
                                <Text style={[styles.tableCell, styles.headerCell, { minWidth: 190 }]}>Email</Text>
                                <Text style={[styles.tableCell, styles.headerCell, { minWidth: 120 }]}>Phone</Text>
                                <Text style={[styles.tableCell, styles.headerCell, { minWidth: 110 }]}>Status</Text>
                                <Text style={[styles.tableCell, styles.headerCell, { minWidth: 100, textAlign: 'center' }]}>Actions</Text>
                            </View>

                            {/* Data Rows */}
                            {filteredBusinesses.map((biz, idx) => {
                                const meta = STATUS_META[biz.subscription_status] || STATUS_META.INACTIVE;
                                return (
                                    <View
                                        key={biz.id}
                                        style={[
                                            styles.tableRow,
                                            idx % 2 === 1 && styles.tableRowAlt,
                                        ]}
                                    >
                                        <Text style={[styles.tableCell, styles.businessNameCell, { minWidth: 220, fontWeight: '700' }]} numberOfLines={1}>
                                            {biz.business_name}
                                        </Text>
                                        <View style={[styles.tableCell, { minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                                            <View style={styles.avatarCircle}>
                                                <Text style={styles.avatarText}>{getInitials(biz.owner_name)}</Text>
                                            </View>
                                            <Text style={{ fontSize: 13, color: '#4B4740' }} numberOfLines={1}>
                                                {biz.owner_name}
                                            </Text>
                                        </View>
                                        <Text style={[styles.tableCell, { minWidth: 190, color: '#797469' }]} numberOfLines={1}>
                                            {biz.email}
                                        </Text>
                                        <Text style={[styles.tableCell, { minWidth: 120, color: '#797469' }]} numberOfLines={1}>
                                            {biz.phone}
                                        </Text>
                                        <View style={[styles.tableCell, { minWidth: 110 }]}>
                                            <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                                                <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
                                                <Text style={[styles.statusText, { color: meta.text }]}>
                                                    {biz.subscription_status || 'INACTIVE'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={[styles.tableCell, { minWidth: 100, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}>
                                            <TouchableOpacity
                                                style={styles.actionBtn}
                                                onPress={() => openModal(biz)}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="create-outline" size={16} color="#2953C4" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.actionBtn, styles.actionBtnDanger]}
                                                onPress={() => handleDelete(biz)}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#C0362C" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            )}

            {!isMobile && (
                <Text style={styles.resultsFootnote}>
                    Showing {filteredBusinesses.length} of {total} restaurant{total === 1 ? '' : 's'}
                </Text>
            )}

            {/* Create/Edit Modal */}
            <Modal
                visible={showCreateModal}
                transparent
                animationType="fade"
                onRequestClose={closeModal}
            >
                <View style={[styles.modalOverlay, isMobile && styles.modalOverlayMobile]}>
                    <View style={[styles.modalContent, isMobile && styles.modalContentMobile]}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderLeft}>
                                <View style={styles.modalIconWrap}>
                                    <Ionicons
                                        name={editingBusiness ? 'create-outline' : 'add-circle-outline'}
                                        size={18}
                                        color="#0A2E23"
                                    />
                                </View>
                                <Text style={styles.modalTitle}>
                                    {editingBusiness ? 'Edit Restaurant' : 'Create Restaurant Account'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={20} color="#6B6759" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 8 }}>
                            {/* Business Name */}
                            <View style={styles.fieldGroup}>
                                <Text style={styles.fieldLabel}>Business Name *</Text>
                                <View style={[styles.fieldInputWrap, focusedField === 'businessName' && styles.fieldInputWrapFocused]}>
                                    <Ionicons name="business-outline" size={16} color={focusedField === 'businessName' ? '#0A2E23' : '#9C9890'} style={styles.fieldIcon} />
                                    <TextInput
                                        style={styles.fieldInput}
                                        value={formData.businessName}
                                        onChangeText={(v) => setFormData({ ...formData, businessName: v })}
                                        placeholder="e.g. Spice Garden"
                                        placeholderTextColor="#B7B2A6"
                                        onFocus={() => setFocusedField('businessName')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                </View>
                            </View>

                            {/* Owner Name */}
                            <View style={styles.fieldGroup}>
                                <Text style={styles.fieldLabel}>Owner Name *</Text>
                                <View style={[styles.fieldInputWrap, focusedField === 'ownerName' && styles.fieldInputWrapFocused]}>
                                    <Ionicons name="person-outline" size={16} color={focusedField === 'ownerName' ? '#0A2E23' : '#9C9890'} style={styles.fieldIcon} />
                                    <TextInput
                                        style={styles.fieldInput}
                                        value={formData.ownerName}
                                        onChangeText={(v) => setFormData({ ...formData, ownerName: v })}
                                        placeholder="Your full name"
                                        placeholderTextColor="#B7B2A6"
                                        onFocus={() => setFocusedField('ownerName')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                </View>
                            </View>

                            {/* Email */}
                            <View style={styles.fieldGroup}>
                                <Text style={styles.fieldLabel}>Email Address *</Text>
                                <View style={[styles.fieldInputWrap, focusedField === 'email' && styles.fieldInputWrapFocused]}>
                                    <Ionicons name="mail-outline" size={16} color={focusedField === 'email' ? '#0A2E23' : '#9C9890'} style={styles.fieldIcon} />
                                    <TextInput
                                        style={styles.fieldInput}
                                        value={formData.email}
                                        onChangeText={(v) => setFormData({ ...formData, email: v })}
                                        placeholder="you@gmail.com"
                                        placeholderTextColor="#B7B2A6"
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        onFocus={() => setFocusedField('email')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                </View>
                            </View>

                            {/* Phone */}
                            <View style={styles.fieldGroup}>
                                <Text style={styles.fieldLabel}>Phone Number *</Text>
                                <View style={[styles.fieldInputWrap, focusedField === 'phone' && styles.fieldInputWrapFocused]}>
                                    <Ionicons name="call-outline" size={16} color={focusedField === 'phone' ? '#0A2E23' : '#9C9890'} style={styles.fieldIcon} />
                                    <TextInput
                                        style={styles.fieldInput}
                                        value={formData.phone}
                                        onChangeText={(v) => setFormData({ ...formData, phone: v })}
                                        placeholder="10-digit mobile number"
                                        placeholderTextColor="#B7B2A6"
                                        keyboardType="phone-pad"
                                        onFocus={() => setFocusedField('phone')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                </View>
                            </View>

                            {/* Password (only for new accounts) */}
                            {!editingBusiness && (
                                <View style={styles.fieldGroup}>
                                    <Text style={styles.fieldLabel}>Password *</Text>
                                    <View style={[styles.fieldInputWrap, focusedField === 'password' && styles.fieldInputWrapFocused]}>
                                        <Ionicons name="lock-closed-outline" size={16} color={focusedField === 'password' ? '#0A2E23' : '#9C9890'} style={styles.fieldIcon} />
                                        <TextInput
                                            style={styles.fieldInput}
                                            value={formData.password}
                                            onChangeText={(v) => setFormData({ ...formData, password: v })}
                                            placeholder="Min 8 chars, e.g. Pass1234"
                                            placeholderTextColor="#B7B2A6"
                                            secureTextEntry
                                            onFocus={() => setFocusedField('password')}
                                            onBlur={() => setFocusedField(null)}
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Referral Code (Optional) - Only for new accounts */}
                            {!editingBusiness && (
                                <View style={styles.fieldGroup}>
                                    <View style={styles.labelRow}>
                                        <Text style={styles.fieldLabel}>Referral Code</Text>
                                        <Text style={styles.optionalBadge}>Optional</Text>
                                    </View>
                                    <View style={[styles.fieldInputWrap, focusedField === 'referralCode' && styles.fieldInputWrapFocused]}>
                                        <Ionicons name="gift-outline" size={16} color={focusedField === 'referralCode' ? '#0A2E23' : '#9C9890'} style={styles.fieldIcon} />
                                        <TextInput
                                            style={styles.fieldInput}
                                            value={formData.referralCode}
                                            onChangeText={(v) => setFormData({ ...formData, referralCode: v })}
                                            placeholder="Got a code?"
                                            placeholderTextColor="#B7B2A6"
                                            autoCapitalize="characters"
                                            onFocus={() => setFocusedField('referralCode')}
                                            onBlur={() => setFocusedField(null)}
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Status (only for editing) */}
                            {editingBusiness && (
                                <View style={styles.fieldGroup}>
                                    <Text style={styles.fieldLabel}>Status</Text>
                                    <View style={styles.statusPickerRow}>
                                        {['TRIAL', 'ACTIVE', 'EXPIRED', 'INACTIVE'].map((status) => {
                                            const isActive = formData.subscription_status === status;
                                            const meta = STATUS_META[status] || STATUS_META.INACTIVE;
                                            return (
                                                <TouchableOpacity
                                                    key={status}
                                                    style={[
                                                        styles.statusPickerChip,
                                                        {
                                                            borderColor: isActive ? '#0A2E23' : '#E7E2D6',
                                                            backgroundColor: isActive ? '#E9F8F1' : '#fff',
                                                        },
                                                    ]}
                                                    onPress={() => setFormData({ ...formData, subscription_status: status })}
                                                    activeOpacity={0.8}
                                                >
                                                    <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
                                                    <Text style={{
                                                        color: isActive ? '#0A2E23' : '#6B6759',
                                                        fontWeight: isActive ? '700' : '500',
                                                        fontSize: 13,
                                                    }}>
                                                        {status}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, styles.modalCancelBtn]}
                                    onPress={closeModal}
                                    activeOpacity={0.75}
                                >
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalBtn, styles.modalSubmitBtn]}
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                    activeOpacity={0.85}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.modalSubmitText}>
                                            {editingBusiness ? 'Update' : 'Create'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

// ─── MAIN ADMIN COMPONENT ──────────────────────────────────────────────────

export default function Admin() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if admin is already logged in
        const token = localStorage.getItem('adminToken');
        if (token) {
            setIsAuthenticated(true);
        }
        setLoading(false);
    }, []);

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
    };

    if (loading) {
        return (
            <View style={loginStyles.pageContent}>
                <ActivityIndicator size="large" color="#0A2E23" />
            </View>
        );
    }

    if (!isAuthenticated) {
        return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
    }

    return <AdminDashboard />;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    scrollRoot: {
        flex: 1,
        backgroundColor: '#F6F3EC',
    },
    adminContainer: {
        flexGrow: 1,
        backgroundColor: '#F6F3EC',
        padding: 28,
        paddingBottom: 52,
        maxWidth: 1320,
        width: '100%',
        alignSelf: 'center',
    },
    adminContainerMobile: {
        padding: 14,
        paddingBottom: 40,
    },
    adminHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 26,
        flexWrap: 'wrap',
        gap: 12,
    },
    adminHeaderLeft: {
        flex: 1,
        minWidth: 160,
    },
    headerEyebrow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        marginBottom: 8,
    },
    headerEyebrowDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#17B26A',
    },
    headerEyebrowText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0D7A4C',
        letterSpacing: 1.4,
    },
    adminTitle: {
        fontSize: 29,
        fontWeight: '800',
        color: '#14181C',
        letterSpacing: -0.7,
    },
    adminTitleMobile: {
        fontSize: 21,
    },
    adminSubtitle: {
        fontSize: 14,
        color: '#797469',
        marginTop: 5,
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: '#fff',
        paddingHorizontal: 15,
        paddingVertical: 11,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: '#F0DCDA',
        shadowColor: '#0A2E23',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    logoutBtnText: {
        color: '#C0362C',
        fontWeight: '700',
        fontSize: 14,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 14,
        marginBottom: 20,
        flexWrap: 'wrap',
    },
    statCard: {
        flex: 1,
        minWidth: 170,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        padding: 18,
        borderRadius: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#EDE8DC',
        borderTopWidth: 3,
        shadowColor: '#0A2E23',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.045,
        shadowRadius: 16,
        elevation: 1,
    },
    statCardMobile: {
        flexBasis: '47%',
        minWidth: 0,
        flex: 0,
        padding: 13,
        gap: 10,
    },
    statIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statNumber: {
        fontSize: 25,
        fontWeight: '800',
        color: '#14181C',
        lineHeight: 29,
        letterSpacing: -0.5,
    },
    statLabel: {
        fontSize: 11.5,
        color: '#797469',
        fontWeight: '600',
        marginTop: 3,
        letterSpacing: 0.1,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 18,
        flexWrap: 'wrap',
    },
    actionsRowMobile: {
        flexDirection: 'column',
    },
    fullWidthBtn: {
        width: '100%',
        justifyContent: 'center',
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#0A2E23',
        paddingHorizontal: 22,
        paddingVertical: 13,
        borderRadius: 11,
        shadowColor: '#0A2E23',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
        elevation: 3,
    },
    createBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
        letterSpacing: 0.1,
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        backgroundColor: '#fff',
        paddingHorizontal: 17,
        paddingVertical: 13,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: '#E7E2D6',
    },
    refreshBtnText: {
        color: '#3F3B33',
        fontWeight: '600',
        fontSize: 14,
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 18,
        flexWrap: 'wrap',
    },
    toolbarMobile: {
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        flex: 1,
        minWidth: 220,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#E7E2D6',
        borderRadius: 11,
        paddingHorizontal: 13,
        paddingVertical: 11,
    },
    searchInput: {
        flex: 1,
        fontSize: 13.5,
        color: '#14181C',
        outlineStyle: 'none',
        minWidth: 0,
    },
    chipRow: {
        flexDirection: 'row',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E7E2D6',
    },
    chipActive: {
        backgroundColor: '#0A2E23',
        borderColor: '#0A2E23',
    },
    chipText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#797469',
    },
    chipTextActive: {
        color: '#fff',
    },
    tableContainer: {
        backgroundColor: '#fff',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#EDE8DC',
        overflow: 'hidden',
        shadowColor: '#0A2E23',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.035,
        shadowRadius: 20,
        elevation: 1,
    },
    tableWrapper: {
        padding: 18,
        minWidth: 850,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F1EB',
        paddingVertical: 13,
        borderRadius: 9,
    },
    tableRowAlt: {
        backgroundColor: '#FBFAF6',
    },
    tableHeaderRow: {
        borderBottomWidth: 2,
        borderBottomColor: '#EDE8DC',
        backgroundColor: 'transparent',
    },
    tableCell: {
        fontSize: 13,
        color: '#4B4740',
        paddingHorizontal: 9,
        flexShrink: 0,
    },
    businessNameCell: {
        color: '#14181C',
    },
    avatarCircle: {
        width: 27,
        height: 27,
        borderRadius: 13.5,
        backgroundColor: '#E4EFE9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#0A2E23',
    },
    headerCell: {
        fontWeight: '700',
        color: '#8A8578',
        textTransform: 'uppercase',
        fontSize: 11,
        letterSpacing: 0.6,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 11,
        paddingVertical: 5.5,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    actionBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#FAF9F5',
        borderWidth: 1,
        borderColor: '#E7E2D6',
    },
    actionBtnDanger: {
        backgroundColor: '#FEF6F5',
        borderColor: '#F6CFCB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F6F3EC',
        minHeight: '100vh',
    },
    loadingText: {
        marginTop: 13,
        fontSize: 14,
        color: '#797469',
    },
    resultsFootnote: {
        fontSize: 12,
        color: '#ACA79A',
        textAlign: 'center',
        marginTop: 16,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 52,
    },
    emptyIconWrap: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: '#F2F1EA',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#14181C',
        marginTop: 15,
    },
    emptyText: {
        fontSize: 14,
        color: '#797469',
        marginTop: 5,
        marginBottom: 20,
        textAlign: 'center',
    },
    emptyCreateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#0A2E23',
        paddingHorizontal: 19,
        paddingVertical: 11,
        borderRadius: 11,
    },
    emptyCreateBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13.5,
    },

    // Mobile card list
    cardList: {
        gap: 13,
    },
    bizCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#EDE8DC',
        padding: 16,
        shadowColor: '#0A2E23',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 1,
    },
    bizCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 12,
    },
    bizCardName: {
        fontSize: 15.5,
        fontWeight: '700',
        color: '#14181C',
        letterSpacing: -0.2,
    },
    bizCardOwnerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        marginTop: 7,
    },
    bizCardOwner: {
        fontSize: 12.5,
        color: '#797469',
    },
    bizCardDivider: {
        height: 1,
        backgroundColor: '#F3F1EB',
        marginBottom: 10,
    },
    bizCardInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        marginBottom: 7,
    },
    bizCardInfoText: {
        fontSize: 12.5,
        color: '#797469',
        flexShrink: 1,
    },
    bizCardActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 9,
    },
    bizCardActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 9,
        borderRadius: 9,
        borderWidth: 1,
    },
    bizCardActionText: {
        fontSize: 12.5,
        fontWeight: '700',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(10,15,12,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalOverlayMobile: {
        padding: 0,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 22,
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 24 },
        shadowOpacity: 0.18,
        shadowRadius: 48,
        elevation: 12,
    },
    modalContentMobile: {
        borderRadius: 0,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        maxHeight: '92vh',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#EDE8DC',
    },
    modalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        flexShrink: 1,
    },
    modalIconWrap: {
        width: 33,
        height: 33,
        borderRadius: 9,
        backgroundColor: '#E9F8F1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseBtn: {
        width: 31,
        height: 31,
        borderRadius: 15.5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAF9F5',
    },
    modalTitle: {
        fontSize: 16.5,
        fontWeight: '700',
        color: '#14181C',
        flexShrink: 1,
        letterSpacing: -0.2,
    },
    modalBody: {
        padding: 20,
    },
    fieldRow: {
        flexDirection: 'row',
        gap: 12,
    },
    fieldRowMobile: {
        flexDirection: 'column',
        gap: 0,
    },
    fieldGroup: {
        marginBottom: 17,
    },
    fieldLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#8A8578',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 7,
    },
    fieldInput: {
        flex: 1,
        paddingHorizontal: 6,
        paddingVertical: 13,
        fontSize: 14,
        color: '#14181C',
        backgroundColor: 'transparent',
        outlineStyle: 'none',
        minWidth: 0,
    },
    fieldInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
        borderBottomWidth: 1.5,
        borderBottomColor: '#E7E2D6',
        borderRadius: 10,
        backgroundColor: '#F7F5EF',
        paddingHorizontal: 4,
    },
    fieldInputWrapFocused: {
        backgroundColor: '#F1F6F3',
        borderBottomColor: '#0A2E23',
    },
    fieldIcon: {
        marginLeft: 10,
        marginRight: 10,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    optionalBadge: {
        fontSize: 10,
        color: '#ACA79A',
        fontWeight: '600',
    },
    statusPickerRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    statusPickerChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1.5,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10,
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 11,
        alignItems: 'center',
    },
    modalCancelBtn: {
        backgroundColor: '#F2F1EA',
    },
    modalCancelText: {
        color: '#4B4740',
        fontWeight: '700',
        fontSize: 14,
    },
    modalSubmitBtn: {
        backgroundColor: '#0A2E23',
        shadowColor: '#0A2E23',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 2,
    },
    modalSubmitText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
        letterSpacing: 0.1,
    },
});