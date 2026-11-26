import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  Film,
  Heart,
  Image as ImageIcon,
  Layers,
  MessageCircle,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { fetchInstagramOverview, InstagramMediaItem } from '../lib/ai';

type MediaFilter = 'all' | 'image' | 'carousel' | 'reel' | 'story';

export default function PostsReelsTab() {
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<InstagramMediaItem[]>([]);

  const loadMedia = async () => {
    setLoading(true);
    const res = await fetchInstagramOverview();
    if (res?.media) {
      setMedia(res.media);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMedia();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim().toLowerCase());
  };

  const handleRefresh = () => {
    loadMedia();
  };

  const filteredMedia = media.filter((item) => {
    const matchesSearch =
      !appliedSearch || (item.caption || '').toLowerCase().includes(appliedSearch);
    if (!matchesSearch) return false;
    if (filter === 'all') return true;
    if (filter === 'image') return item.media_type === 'IMAGE';
    if (filter === 'carousel') return item.media_type === 'CAROUSEL_ALBUM';
    if (filter === 'reel') return item.media_type === 'VIDEO';
    return true;
  });

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 22,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Posts &amp; Reels
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
            Browse your Instagram content
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 14px',
            borderRadius: 9,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <RefreshCw size={14} />
          {loading ? 'Syncing...' : 'Sync Media'}
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 16,
          marginBottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={15}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by caption..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 9,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13.5,
                outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '9px 18px',
              borderRadius: 9,
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>

        {/* Media Type Filter Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(
            [
              { id: 'all', label: 'All Media', icon: Sparkles },
              { id: 'image', label: 'Posts (Images)', icon: ImageIcon },
              { id: 'carousel', label: 'Carousel', icon: Layers },
              { id: 'reel', label: 'Reels', icon: Film },
              { id: 'story', label: 'Stories', icon: RefreshCw },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 13px',
                  borderRadius: 8,
                  border: active ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border)',
                  background: active ? 'rgba(99, 102, 241, 0.14)' : 'var(--bg)',
                  color: active ? '#a5b4fc' : 'var(--text-muted)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '56px 20px',
          textAlign: 'center',
        }}
      >
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>
            Fetching posts &amp; stories...
          </div>
        ) : filteredMedia.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 14,
              textAlign: 'left',
            }}
          >
            {filteredMedia.map((item) => {
              const thumb = item.thumbnail_url || item.media_url;
              return (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={item.caption || 'Instagram post'}
                      style={{ width: '100%', height: 180, objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 180,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--surface)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Film size={24} />
                    </div>
                  )}
                  <div style={{ padding: 12 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'var(--text)',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        marginBottom: 10,
                      }}
                    >
                      {item.caption || 'No caption'}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        color: 'var(--text-muted)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Heart size={12} /> {item.like_count ?? 0}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MessageCircle size={12} /> {item.comments_count ?? 0}
                        </span>
                      </div>
                      {item.permalink && (
                        <a
                          href={item.permalink}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#a5b4fc', display: 'inline-flex', alignItems: 'center' }}
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'var(--primary-soft)',
                color: '#fb7185',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <Film size={22} />
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 6 }}>
              {appliedSearch ? `No media matching "${appliedSearch}"` : 'No Media Loaded Yet'}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                maxWidth: 420,
                margin: '0 auto',
                lineHeight: 1.5,
              }}
            >
              Click Sync Media to fetch posts, carousels, reels, and stories from @jhoomo.events.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
