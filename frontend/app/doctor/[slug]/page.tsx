'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface DoctorProfile {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  gender?: string;
  dateOfBirth?: string;
  verificationStatus?: string;
  doctorProfile: {
    specializations: string[];
    qualifications: Array<{ degree: string; institution: string; year: number }> | string[];
    yearsOfExperience?: number;
    bio?: string;
    licenseNumber?: string;
    licenseState?: string;
    licenseExpiry?: string;
    certificates: Array<{
      title: string;
      issuingOrganization: string;
      issueDate: string;
      expiryDate?: string;
      certificateUrl?: string;
    }>;
    achievements: Array<{
      title: string;
      description: string;
      date: string;
      category: string;
    }>;
    consultationFee?: number;
    onlineConsultationFee?: number;
    offersOnlineConsultation?: boolean;
    languages?: string[];
  };
  hospitals?: Array<{
    id: string;
    name: string;
    type?: string;
    address?: { city?: string; state?: string };
    department?: string;
    employmentType?: string;
  }>;
}

export default function PublicDoctorProfile() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDoctorProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://medchain-x96u.onrender.com/api'}/profile/doctor/public/${slug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Doctor profile not found');
          } else {
            setError('Failed to load profile');
          }
          return;
        }
        
        const data = await response.json();
        setDoctor(data.data.profile);
      } catch (err) {
        console.error('Error fetching doctor profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchDoctorProfile();
    }
  }, [slug]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p>Loading doctor profile...</p>
        </div>
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <h1 style={styles.errorTitle}>Profile Not Found</h1>
          <p style={styles.errorText}>
            {error || 'This doctor profile is not available or has been set to private.'}
          </p>
          <a href="/" style={styles.homeLink}>← Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header Section */}
        <div style={styles.header}>
          <div style={styles.avatarContainer}>
            {doctor.profileImage ? (
              <img src={doctor.profileImage} alt={doctor.fullName} style={styles.avatar} />
            ) : (
              <div style={styles.avatarPlaceholder}>
                {doctor.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
            )}
          </div>
          <div style={styles.headerInfo}>
            <h1 style={styles.name}>Dr. {doctor.fullName}</h1>
            <p style={styles.specialization}>
              {doctor.doctorProfile.specializations?.join(', ') || 'General Practice'}
            </p>
            {doctor.doctorProfile.yearsOfExperience && (
              <p style={styles.experience}>{doctor.doctorProfile.yearsOfExperience} years of experience</p>
            )}
          </div>
        </div>

        {/* Contact Info */}
        {(doctor.email || doctor.phone) && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Contact Information</h2>
            <div style={styles.contactGrid}>
              {doctor.email && (
                <div style={styles.contactItem}>
                  <span style={styles.contactLabel}>📧 Email:</span>
                  <a href={`mailto:${doctor.email}`} style={styles.contactValue}>{doctor.email}</a>
                </div>
              )}
              {doctor.phone && (
                <div style={styles.contactItem}>
                  <span style={styles.contactLabel}>📞 Phone:</span>
                  <a href={`tel:${doctor.phone}`} style={styles.contactValue}>{doctor.phone}</a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bio */}
        {doctor.doctorProfile.bio && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>About</h2>
            <p style={styles.bio}>{doctor.doctorProfile.bio}</p>
          </div>
        )}

        {/* Languages */}
        {doctor.doctorProfile.languages && doctor.doctorProfile.languages.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Languages</h2>
            <div style={styles.tagContainer}>
              {doctor.doctorProfile.languages.map((lang, index) => (
                <span key={index} style={styles.langTag}>{lang}</span>
              ))}
            </div>
          </div>
        )}

        {/* Qualifications */}
        {doctor.doctorProfile.qualifications && doctor.doctorProfile.qualifications.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Qualifications</h2>
            <div style={styles.tagContainer}>
              {doctor.doctorProfile.qualifications.map((qual, index) => (
                <span key={index} style={styles.tag}>
                  {typeof qual === 'string' ? qual : `${qual.degree}${qual.institution ? ` — ${qual.institution}` : ''}${qual.year ? ` (${qual.year})` : ''}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Certificates */}
        {doctor.doctorProfile.certificates && doctor.doctorProfile.certificates.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Certifications</h2>
            <div style={styles.certGrid}>
              {doctor.doctorProfile.certificates.map((cert, index) => (
                <div key={index} style={styles.certCard}>
                  <h3 style={styles.certTitle}>{cert.title}</h3>
                  <p style={styles.certOrg}>{cert.issuingOrganization}</p>
                  <p style={styles.certDate}>
                    Issued: {new Date(cert.issueDate).toLocaleDateString()}
                    {cert.expiryDate && ` • Expires: ${new Date(cert.expiryDate).toLocaleDateString()}`}
                  </p>
                  {cert.certificateUrl && (
                    <a href={cert.certificateUrl} target="_blank" rel="noopener noreferrer" style={styles.viewCert}>
                      View Certificate →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        {doctor.doctorProfile.achievements && doctor.doctorProfile.achievements.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Achievements</h2>
            <div style={styles.achievementList}>
              {doctor.doctorProfile.achievements.map((achievement, index) => (
                <div key={index} style={styles.achievementItem}>
                  <div style={styles.achievementHeader}>
                    <span style={styles.achievementCategory}>{achievement.category}</span>
                    <span style={styles.achievementDate}>
                      {new Date(achievement.date).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 style={styles.achievementTitle}>{achievement.title}</h3>
                  <p style={styles.achievementDesc}>{achievement.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Consultation Info */}
        {(doctor.doctorProfile.consultationFee || doctor.doctorProfile.offersOnlineConsultation) && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Consultation</h2>
            <div style={styles.contactGrid}>
              {doctor.doctorProfile.consultationFee && (
                <div style={styles.contactItem}>
                  <span style={styles.contactLabel}>🏥 In-person fee:</span>
                  <span style={{ ...styles.contactValue, color: '#059669', fontWeight: 600 }}>₹{doctor.doctorProfile.consultationFee}</span>
                </div>
              )}
              {doctor.doctorProfile.offersOnlineConsultation && (
                <div style={styles.contactItem}>
                  <span style={styles.contactLabel}>💻 Online consultation:</span>
                  <span style={{ ...styles.contactValue, color: '#059669', fontWeight: 600 }}>
                    {doctor.doctorProfile.onlineConsultationFee ? `₹${doctor.doctorProfile.onlineConsultationFee}` : 'Available'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* License Info */}
        {(doctor.doctorProfile.licenseNumber || doctor.doctorProfile.licenseState) && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Medical License</h2>
            <div style={styles.contactGrid}>
              {doctor.doctorProfile.licenseNumber && (
                <div style={styles.contactItem}>
                  <span style={styles.contactLabel}>🪪 License No:</span>
                  <span style={styles.contactValue}>{doctor.doctorProfile.licenseNumber}</span>
                </div>
              )}
              {doctor.doctorProfile.licenseState && (
                <div style={styles.contactItem}>
                  <span style={styles.contactLabel}>📍 State/Council:</span>
                  <span style={styles.contactValue}>{doctor.doctorProfile.licenseState}</span>
                </div>
              )}
              {doctor.doctorProfile.licenseExpiry && (
                <div style={styles.contactItem}>
                  <span style={styles.contactLabel}>📅 Valid until:</span>
                  <span style={styles.contactValue}>{new Date(doctor.doctorProfile.licenseExpiry).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hospital Affiliations */}
        {doctor.hospitals && doctor.hospitals.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Hospital Affiliations</h2>
            <div style={styles.hospitalList}>
              {doctor.hospitals.map((h, i) => (
                <div key={i} style={styles.hospitalItem}>
                  <h3 style={styles.hospitalName}>🏥 {h.name}</h3>
                  {h.department && <p style={styles.hospitalDept}>Department: {h.department}</p>}
                  {h.address?.city && (
                    <p style={styles.hospitalDate}>{h.address.city}{h.address.state ? `, ${h.address.state}` : ''}</p>
                  )}
                  {h.employmentType && (
                    <p style={styles.hospitalDate}>{h.employmentType.replace('_', ' ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verification Badge */}
        {doctor.verificationStatus === 'VERIFIED' && (
          <div style={{ ...styles.section, textAlign: 'center' }}>
            <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '0.5rem 1.25rem', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 600 }}>
              ✅ Blockchain Verified Profile
            </span>
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Profile verified by MedChain Healthcare Platform
          </p>
          <div style={styles.poweredBy}>
            <span>🏥 MedChain</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f7fa',
    padding: '2rem 1rem',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    color: '#666',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e0e0e0',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '1rem',
  },
  errorCard: {
    maxWidth: '500px',
    margin: '4rem auto',
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '3rem',
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  errorTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: '1rem',
  },
  errorText: {
    color: '#666',
    marginBottom: '2rem',
  },
  homeLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: '500',
  },
  card: {
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    padding: '2rem',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    color: '#fff',
  },
  avatarContainer: {
    flexShrink: 0,
  },
  avatar: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '4px solid rgba(255,255,255,0.3)',
  },
  avatarPlaceholder: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    fontWeight: '600',
    border: '4px solid rgba(255,255,255,0.3)',
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: '1.75rem',
    fontWeight: '700',
    marginBottom: '0.25rem',
  },
  specialization: {
    fontSize: '1.1rem',
    opacity: 0.9,
    marginBottom: '0.25rem',
  },
  experience: {
    fontSize: '0.9rem',
    opacity: 0.8,
  },
  section: {
    padding: '1.5rem 2rem',
    borderBottom: '1px solid #f0f0f0',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#333',
    marginBottom: '1rem',
  },
  contactGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  contactLabel: {
    color: '#666',
    fontWeight: '500',
  },
  contactValue: {
    color: '#3b82f6',
    textDecoration: 'none',
  },
  fee: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#059669',
  },
  bio: {
    color: '#555',
    lineHeight: 1.6,
  },
  tagContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  tag: {
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    padding: '0.375rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  langTag: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    padding: '0.375rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  certGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '1rem',
  },
  certCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    padding: '1rem',
    border: '1px solid #e5e7eb',
  },
  certTitle: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#333',
    marginBottom: '0.25rem',
  },
  certOrg: {
    fontSize: '0.875rem',
    color: '#666',
    marginBottom: '0.25rem',
  },
  certDate: {
    fontSize: '0.8rem',
    color: '#888',
    marginBottom: '0.5rem',
  },
  viewCert: {
    fontSize: '0.8rem',
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: '500',
  },
  achievementList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  achievementItem: {
    backgroundColor: '#fffbeb',
    borderRadius: '8px',
    padding: '1rem',
    borderLeft: '4px solid #f59e0b',
  },
  achievementHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  achievementCategory: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  achievementDate: {
    fontSize: '0.75rem',
    color: '#888',
  },
  achievementTitle: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#333',
    marginBottom: '0.25rem',
  },
  achievementDesc: {
    fontSize: '0.875rem',
    color: '#555',
  },
  hospitalList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  hospitalItem: {
    backgroundColor: '#f0fdf4',
    borderRadius: '8px',
    padding: '1rem',
    borderLeft: '4px solid #22c55e',
  },
  hospitalName: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#333',
    marginBottom: '0.25rem',
  },
  hospitalDept: {
    fontSize: '0.875rem',
    color: '#666',
    marginBottom: '0.25rem',
  },
  hospitalDate: {
    fontSize: '0.8rem',
    color: '#888',
  },
  footer: {
    padding: '1.5rem 2rem',
    textAlign: 'center',
    backgroundColor: '#f9fafb',
  },
  footerText: {
    fontSize: '0.8rem',
    color: '#888',
    marginBottom: '0.5rem',
  },
  poweredBy: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#3b82f6',
  },
};
