import React, { useState } from 'react';

/**
 * PortalAuthView
 * 
 * Dedicated Role-Based Authentication Gateway for each of the three HydroTwin-PHM portals:
 * 1. Operator & Engineering Access (Virtual HIL Testbed)
 * 2. Consumer Access (Consumer Mobile App / Dashboard)
 * 3. OEM Fleet Portal (Operations & Support)
 * 
 * Styled in the signature White & Olive aesthetic (#FAFCF7, #1F2D19, #384828, #6C8360, #BACAB3).
 */

const PORTAL_CONFIGS = {
  hil: {
    key: 'hil',
    tabLabel: 'Virtual HIL Testbed',
    category: 'OPERATOR & ENGINEERING ACCESS',
    badge: 'ENGINEERING LEVEL 3 CLEARANCE',
    title: 'Atomberg R&D & Virtual HIL Testbed',
    subtitle: 'Hardware-in-the-Loop Firmware Validation, Interlock Telemetry & Fault Injection Console',
    whoUsesIt: 'Atomberg R&D engineers, firmware developers, validation engineers, and fleet diagnostic technicians.',
    whyItExists:
      'It provides low-level simulation controls to inject faults (e.g., locked rotor stall, dry-run cavitation, severe line pressure drops), manually override sensor inputs (TDS, flow rate, armature current), view raw ADC/PWM signals, and test deterministic sub-200ms edge safety interlocks without needing physical test benches or damaging real components.',
    securityNotice:
      'RESTRICTED ENGINEERING ZONE: FreeRTOS dual-core task synchronization, pump motor armature relay overrides, and Darcy-Hermia physical cake resistance parameters are armed.',
    loginLabel: 'Engineering Corporate SSO / Developer ID',
    loginPlaceholder: 'e.g., alok.mishra@atomberg.internal',
    passwordLabel: 'Hardware Security Key / Firmware Token',
    passwordPlaceholder: 'Enter security passkey',
    defaultUser: 'alok.mishra@atomberg.internal',
    defaultPass: 'AtombergHIL@2026',
    demoProfiles: [
      {
        name: 'Alok Mishra',
        role: 'Chief Firmware & Interlock Architect',
        email: 'alok.mishra@atomberg.internal',
        pass: 'AtombergHIL@2026',
        badge: 'Staff Engineer • Level 3',
        location: 'Atomberg R&D Center, Pune'
      },
      {
        name: 'Pooja Verma',
        role: 'Hardware Validation & Diagnostic Engineer',
        email: 'pooja.verma@atomberg.internal',
        pass: 'AtombergHIL@2026',
        badge: 'Validation Lead • Level 2',
        location: 'Embedded Systems Lab, Bengaluru'
      }
    ]
  },

  consumer: {
    key: 'consumer',
    tabLabel: 'Consumer App',
    category: 'CONSUMER ACCESS (HOMEOWNERS & END-USERS)',
    badge: 'CONSUMER LOGIN PORTAL',
    title: 'Atomberg Intellon Home Water • Consumer Login',
    subtitle: 'Homeowner Access: Real-Time Permeate Purity, Remaining Filter Life & Proactive Doorstep Delivery',
    whoUsesIt: 'Everyday homeowners and end-users.',
    whyItExists:
      'Consumers only see high-level, actionable data—such as clean drinking water quality, remaining filter life countdowns in days, simple mode selectors (like TasteTune™ or Adaptive Flow), and automated doorstep cartridge delivery notifications. They are shielded from raw electrical parameters, fault injection buttons, and engineering relays to prevent accidental system trips or confusion.',
    securityNotice:
      'CONSUMER-SAFE INTERFACE: Directly manages drinking water mineralization (pH ~7.8), diurnal consumption tracking, TasteTune™ profiles, and automatic BlueDart doorstep filter delivery without complex engineering relays.',
    loginLabel: 'Registered Mobile Number or Homeowner Email',
    loginPlaceholder: 'e.g., rajesh.sharma@gmail.com or +91 98260 42000',
    passwordLabel: '4-Digit Home Passcode or Account Password',
    passwordPlaceholder: 'Enter account passcode (e.g. 2026)',
    defaultUser: 'rajesh.sharma@gmail.com',
    defaultPass: 'WaterSafe@2026',
    demoProfiles: [
      {
        name: 'Rajesh Sharma',
        role: 'Verified Homeowner',
        email: 'rajesh.sharma@gmail.com',
        pass: 'WaterSafe@2026',
        badge: 'Kitchen Purifier #ATOM-WP-2026-0042',
        location: 'Arera Colony, E-3, Bhopal, MP'
      },
      {
        name: 'Neha Joshi',
        role: 'Smart Home Customer',
        email: 'neha.joshi@gmail.com',
        pass: 'WaterSafe@2026',
        badge: 'Purifier Unit #ATOM-WP-2026-0055',
        location: 'Vijay Nagar, Scheme 54, Indore, MP'
      }
    ]
  },

  fleet: {
    key: 'fleet',
    tabLabel: 'Fleet OEM Portal',
    category: 'OEM FLEET PORTAL (OPERATIONS & SUPPORT)',
    badge: 'REGIONAL SERVICE & D2C SUPPLY CHAIN',
    title: 'Atomberg OEM National Fleet & Logistics',
    subtitle: 'Multi-Cluster Health Monitoring, 15-State Groundwater Telemetry & D2C Dispatch Queue',
    whoUsesIt: 'Regional service managers, supply chain teams, and OEM support staff.',
    whyItExists:
      'It monitors multi-device health across city clusters (e.g., Bhopal, Sehore, Ahmedabad), manages automated D2C cartridge dispatch queues, and tracks regional scaling trends.',
    securityNotice:
      'ENTERPRISE FLEET ACCESS: Oversees 75 city clusters across 15 Indian States, real-time Darcy-Hermia regional membrane fouling patterns, and automated doorstep dispatch routing with logistics carriers.',
    loginLabel: 'OEM Service SSO / Operations Staff ID',
    loginPlaceholder: 'e.g., vikram.rathore@atomberg.com',
    passwordLabel: 'Logistics Division Authorization Key',
    passwordPlaceholder: 'Enter operations access key',
    defaultUser: 'vikram.rathore@atomberg.com',
    defaultPass: 'FleetOps@2026',
    demoProfiles: [
      {
        name: 'Vikram Rathore',
        role: 'Regional Service & Support Director',
        email: 'vikram.rathore@atomberg.com',
        pass: 'FleetOps@2026',
        badge: 'Central & Western Region (15 States)',
        location: 'Regional Operations Hub, Bhopal'
      },
      {
        name: 'Sunita Deshmukh',
        role: 'National D2C Supply Chain Manager',
        email: 'sunita.deshmukh@atomberg.com',
        pass: 'FleetOps@2026',
        badge: 'Automated Logistics Dispatch',
        location: 'Supply Chain Center, Mumbai'
      }
    ]
  }
};

function PortalAuthView({ role = 'hil', onLoginSuccess, onSwitchPortal }) {
  const config = PORTAL_CONFIGS[role] || PORTAL_CONFIGS.hil;

  const [username, setUsername] = useState(config.defaultUser);
  const [password, setPassword] = useState(config.defaultPass);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle direct custom form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim()) {
      setErrorMsg(`Please enter your ${config.loginLabel}.`);
      return;
    }
    if (!password.trim()) {
      setErrorMsg(`Please enter your ${config.passwordLabel}.`);
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      // Construct user profile
      const userProfile = {
        name: username.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        email: username,
        role: config.category,
        badge: config.badge,
        portal: role,
        loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      if (onLoginSuccess) {
        onLoginSuccess(role, userProfile);
      }
    }, 400);
  };

  // Handle 1-click instant demo profile login
  const handleQuickDemoLogin = (profile) => {
    setUsername(profile.email);
    setPassword(profile.pass);
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const userProfile = {
        name: profile.name,
        email: profile.email,
        designation: profile.role,
        role: config.category,
        badge: profile.badge,
        location: profile.location,
        portal: role,
        loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      if (onLoginSuccess) {
        onLoginSuccess(role, userProfile);
      }
    }, 300);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4 px-2 sm:px-4 animate-fadeIn">
      {/* ----------------------------------------------------------------- */}
      {/* Main Authentication Card */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl border border-[#DCE4D6] shadow-xl overflow-hidden">
        {/* Card Header Banner */}
        <div className="bg-gradient-to-r from-[#1F2D19] via-[#2A3B22] to-[#384828] text-white p-6 sm:p-8 space-y-4 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-2 flex items-center justify-center shrink-0 shadow-md">
                <img
                  src={`${process.env.PUBLIC_URL}/assets/hydrotwin_emblem.png`}
                  alt="HydroTwin Emblem"
                  className="w-full h-full object-contain filter drop-shadow-sm"
                />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-white/15 px-2.5 py-0.5 rounded text-white border border-white/20">
                    {config.category}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {config.title}
                </h2>
                <p className="text-xs text-white/80 max-w-xl">
                  {config.subtitle}
                </p>
              </div>
            </div>

            <div className="self-start sm:self-center bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-right shrink-0">
              <div className="text-[9px] uppercase tracking-wider text-white/70 font-semibold">Security Clearance</div>
              <div className="text-xs font-mono font-bold text-white">{config.badge}</div>
            </div>
          </div>
        </div>

        {/* Authorized Access Banner */}
        <div className="bg-[#FAFBF8] border-b border-[#E3E9DE] px-6 py-3.5 flex items-center space-x-3 text-xs">
          <div className="w-6 h-6 rounded-lg bg-[#EAEFE5] text-[#384828] flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="text-xs text-[#3E4D37] leading-snug">
            <span className="font-bold text-[#1F2D19] uppercase tracking-wider text-[11px]">Authorized Access: </span>
            <span className="font-medium text-[#54684A]">{config.whoUsesIt}</span>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Interactive Login Form & 1-Click Demo Profiles */}
        {/* ----------------------------------------------------------------- */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Login Form (7 Cols) */}
            <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#1F2D19] flex items-center space-x-2">
                  <span>Sign In with Authorized Credentials</span>
                </h3>
                <p className="text-xs text-[#6C7E66]">
                  Enter your assigned credentials below or choose a verified test persona from the right.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-2">
                  <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Username Input */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#2A3525] uppercase tracking-wider">
                  {config.loginLabel}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={config.loginPlaceholder}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#F4F6F0] border border-[#BACAB3] rounded-xl text-[#1F2D19] placeholder-[#889A80] focus:outline-none focus:ring-2 focus:ring-[#384828] transition-all font-mono"
                  />
                  <div className="absolute right-3 top-3 text-[#6C7E66]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-[#2A3525] uppercase tracking-wider">
                    {config.passwordLabel}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-[#54684A] hover:text-[#1F2D19] font-medium"
                  >
                    {showPassword ? 'Hide Secret' : 'Show Secret'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={config.passwordPlaceholder}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#F4F6F0] border border-[#BACAB3] rounded-xl text-[#1F2D19] placeholder-[#889A80] focus:outline-none focus:ring-2 focus:ring-[#384828] transition-all font-mono"
                  />
                  <div className="absolute right-3 top-3 text-[#6C7E66]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Checkbox & Forgot */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center space-x-2 cursor-pointer text-[#3E4D37]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded text-[#384828] focus:ring-[#384828]"
                  />
                  <span>Persist session in local browser storage</span>
                </label>
                <span className="text-[11px] text-[#6C7E66] font-mono">
                  Role: {config.tabLabel}
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-[#1F2D19] hover:bg-[#2A3B22] text-white font-bold text-sm tracking-wide transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 disabled:opacity-75 cursor-pointer mt-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Verifying Security Clearance...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span>Enter {config.tabLabel}</span>
                  </>
                )}
              </button>
            </form>

            {/* Right Column: 1-Click Fast Demo Personas (5 Cols) */}
            <div className="lg:col-span-5 bg-[#F8FAF5] border border-[#DCE4D6] rounded-2xl p-5 space-y-4">
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#54684A]">
                  AtomQuest 2026 Evaluator Fast-Track
                </div>
                <h4 className="text-sm font-bold text-[#1F2D19] flex items-center space-x-1.5">
                  <svg className="w-4 h-4 text-[#384828]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>1-Click Test Personas</span>
                </h4>
                <p className="text-[11px] text-[#6C7E66]">
                  Click any verified profile below to auto-authenticate instantly:
                </p>
              </div>

              <div className="space-y-2.5">
                {config.demoProfiles.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickDemoLogin(p)}
                    className="w-full text-left p-3.5 rounded-xl bg-white hover:bg-[#EAEFE5] border border-[#DCE4D6] hover:border-[#BACAB3] transition-all shadow-2xs group cursor-pointer space-y-1"
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-[#1F2D19] text-xs group-hover:text-[#384828]">
                        {p.name}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#EAEFE5] text-[#384828] group-hover:bg-[#384828] group-hover:text-white transition-colors">
                        1-Click Login →
                      </span>
                    </div>
                    <div className="text-[11px] text-[#54684A] font-medium">{p.role}</div>
                    <div className="text-[10px] text-[#889A80] font-mono flex items-center space-x-1">
                      <span>{p.location}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-[#E3E9DE] text-[10px] text-[#6C7E66] space-y-1">
                <div className="font-bold text-[#2A3525]">Security Protocol:</div>
                <p>{config.securityNotice}</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default PortalAuthView;
