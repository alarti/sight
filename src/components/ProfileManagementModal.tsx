/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  User, Plus, Trash2, Download, Upload, Target, Check, X, Calendar, Globe
} from 'lucide-react';
import { 
  UserProfile, createNewProfile, exportSingleProfileJSON, exportProfilesJSON, importProfilesJSON 
} from '../profileManager.ts';
import { Language, translations } from '../i18n/translations.ts';

interface ProfileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: UserProfile[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  onSaveProfilesList: (updatedList: UserProfile[], newActiveId?: string) => void;
  onLaunchCalibration: (profile: UserProfile) => void;
  onSpeak: (text: string) => void;
  currentLanguage?: Language;
}

export const ProfileManagementModal: React.FC<ProfileManagementModalProps> = ({
  isOpen,
  onClose,
  profiles,
  activeProfileId,
  onSelectProfile,
  onSaveProfilesList,
  onLaunchCalibration,
  onSpeak,
  currentLanguage = 'es'
}) => {
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [newProfileLanguage, setNewProfileLanguage] = useState<Language>(currentLanguage);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[currentLanguage].profileModal;

  if (!isOpen) return null;

  const handleCreateProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newProfileName.trim();
    if (!name) {
      setErrorMessage(currentLanguage === 'en' ? "Please enter a profile name" : "Por favor introduzca un nombre para el nuevo perfil");
      return;
    }

    const newProf = createNewProfile(name, newProfileLanguage);
    const updated = [...profiles, newProf];
    onSaveProfilesList(updated, newProf.id);
    setNewProfileName('');
    setErrorMessage(null);
    onSpeak(currentLanguage === 'en'
      ? `Profile ${name} created. Launching calibration wizard.`
      : `Perfil ${name} creado con éxito. Iniciando asistente de calibración.`
    );
    onClose();
    setTimeout(() => {
      onLaunchCalibration(newProf);
    }, 300);
  };

  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) {
      setErrorMessage(currentLanguage === 'en' ? "At least one active profile is required." : "Debe existir al menos un perfil activo en el sistema.");
      setProfileToDelete(null);
      return;
    }

    const deleted = profiles.find(p => p.id === id);
    const updated = profiles.filter(p => p.id !== id);
    let nextActiveId = activeProfileId;
    if (activeProfileId === id) {
      nextActiveId = updated[0].id;
    }

    onSaveProfilesList(updated, nextActiveId);
    setProfileToDelete(null);
    setErrorMessage(null);
    if (deleted) {
      onSpeak(currentLanguage === 'en' ? `Profile ${deleted.name} deleted.` : `Perfil ${deleted.name} eliminado.`);
    }
  };

  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const restored = await importProfilesJSON(file);
      onSaveProfilesList(restored, restored[0]?.id);
      onSpeak(currentLanguage === 'en' ? 'Profiles restored from JSON backup.' : 'Perfiles restaurados desde JSON con éxito.');
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(currentLanguage === 'en' ? `Error restoring backup: ${err.message}` : `Error al restaurar archivo: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-[10010] bg-[var(--bg-canvas)]/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      <div 
        className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HIDDEN FILE INPUT FOR RESTORE */}
        <input 
          ref={fileInputRef} 
          type="file" 
          accept=".json" 
          onChange={handleFileRestore} 
          className="hidden" 
        />

        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent-primary)]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] tracking-tight">{t.title}</h2>
              <p className="text-xs text-[var(--text-muted)] font-mono">{t.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3 bg-[var(--bg-canvas)] border border-[var(--accent-urgent)] text-[var(--accent-urgent)] rounded-xl text-xs flex items-center justify-between">
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="underline ml-2">Cerrar</button>
            </div>
          )}

          {/* CREATE PROFILE FORM */}
          <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-xl p-4 sm:p-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-[0.12em] font-semibold text-[var(--accent-primary)] flex items-center gap-2">
              <Plus className="w-3.5 h-3.5" />
              {t.createNewTitle}
            </h3>

            <form onSubmit={handleCreateProfile} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder={t.profileNamePlaceholder}
                  className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg px-3.5 py-2 text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-active)]"
                />

                {/* LANGUAGE SELECTOR */}
                <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg px-2 py-1 font-mono">
                  <Globe className="w-3.5 h-3.5 text-[var(--text-muted)] mr-1" />
                  <button
                    type="button"
                    onClick={() => setNewProfileLanguage('es')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                      newProfileLanguage === 'es'
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    ES
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProfileLanguage('en')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                      newProfileLanguage === 'en'
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    EN
                  </button>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.createBtn}
                </button>
              </div>
            </form>
          </div>

          {/* LIST OF EXISTING PROFILES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)] px-1 tabular-nums">
              <span>{t.existingProfiles} ({profiles.length})</span>
              <span>
                {profiles.filter(p => (p.samples && p.samples.length >= 4) || p.calibrationMatrix).length} {t.calibratedBadge}
              </span>
            </div>

            <div className="space-y-2.5">
              {profiles.map((prof) => {
                const isActive = prof.id === activeProfileId;
                const isCalibrated = (prof.samples && prof.samples.length >= 4) || !!prof.calibrationMatrix;

                return (
                  <div
                    key={prof.id}
                    className={`p-4 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isActive
                        ? 'bg-[var(--bg-elevated)] border-[var(--border-active)]'
                        : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] hover:border-[var(--border-active)]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-[var(--text-primary)]">{prof.name}</span>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">·</span>
                        <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                          {prof.language === 'en' ? 'English' : 'Español'}
                        </span>
                        {isActive && (
                          <>
                            <span className="text-[11px] font-mono text-[var(--text-muted)]">·</span>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent-primary)] font-semibold">
                              {t.activeBadge}
                            </span>
                          </>
                        )}
                        {isCalibrated && (
                          <>
                            <span className="text-[11px] font-mono text-[var(--text-muted)]">·</span>
                            <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                              {t.calibratedBadge}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-[var(--text-muted)] font-mono tabular-nums flex-wrap">
                        <span>Sens X {prof.sensitivityX?.toFixed(1) || '14.0'}x · Y {prof.sensitivityY?.toFixed(1) || '14.0'}x</span>
                        <span>·</span>
                        <span>{prof.samples?.length || 0} {t.interactions}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(prof.updatedAt || prof.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {!isActive && (
                        <button
                          onClick={() => {
                            onSelectProfile(prof.id);
                            onSpeak(currentLanguage === 'en' ? `Switched to profile ${prof.name}` : `Cambiado al perfil ${prof.name}`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-primary)] text-xs font-medium border border-[var(--border-hairline)] transition-colors"
                        >
                          {currentLanguage === 'en' ? 'Activate' : 'Activar'}
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onSelectProfile(prof.id);
                          onClose();
                          setTimeout(() => onLaunchCalibration(prof), 200);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] hover:border-[var(--border-active)] border border-[var(--border-hairline)] text-[var(--accent-primary)] text-xs font-medium flex items-center gap-1.5 transition-colors"
                        title={t.calibrateBtn}
                      >
                        <Target className="w-3.5 h-3.5" />
                        <span>{t.calibrateBtn}</span>
                      </button>

                      <button
                        onClick={() => exportSingleProfileJSON(prof)}
                        className="p-2 rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] transition-colors"
                        title="Exportar perfil"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {profileToDelete === prof.id ? (
                        <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--accent-urgent)] rounded-lg p-1">
                          <button
                            onClick={() => handleDeleteProfile(prof.id)}
                            className="p-1 rounded text-[var(--accent-urgent)]"
                            title="Confirmar eliminación"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setProfileToDelete(null)}
                            className="p-1 rounded text-[var(--text-muted)]"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setProfileToDelete(prof.id)}
                          disabled={profiles.length <= 1}
                          className="p-2 rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--accent-urgent)] border border-[var(--border-hairline)] transition-colors disabled:opacity-40"
                          title={t.deleteBtn}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                exportProfilesJSON();
                onSpeak(currentLanguage === 'en' ? 'Profiles backup exported.' : 'Copia de seguridad exportada.');
              }}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t.exportBackup}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t.restoreBackup}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg text-xs font-semibold transition-colors"
          >
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
