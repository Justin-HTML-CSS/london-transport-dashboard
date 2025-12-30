import React, { useState } from 'react';
import '../styles/App.css';

const TABS = [
  { key: 'journey', label: 'Journey' },
  { key: 'live', label: 'Live Vehicles' },
];

export default function TopNav({ currentTab = 'journey', onTabChange = () => {} }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleTabClick = (e, key) => {
    e.preventDefault();
    setMenuOpen(false);
    onTabChange(key);
  };

  const toggleMenu = (e) => {
    e.preventDefault();
    setMenuOpen(prev => !prev);
  };

  return (
    <nav 
      className={`topnav${menuOpen ? ' responsive' : ''}`} 
      id="myTopnav" 
      role="navigation" 
      aria-label="Main Navigation"
    >
      {TABS.map(tab => (
        <a
          key={tab.key}
          href={`#${tab.key}`}
          className={`tab-link ${currentTab === tab.key ? 'active' : ''}`}
          onClick={(e) => handleTabClick(e, tab.key)}
          role="tab"
          aria-selected={currentTab === tab.key}
        >
          {tab.label}
        </a>
      ))}
      <button
        type="button"
        className="menu-icon"
        onClick={toggleMenu}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
      >
        {menuOpen ? '✕' : '☰'}
      </button>
    </nav>
  );
}