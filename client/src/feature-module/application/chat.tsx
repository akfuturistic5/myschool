import  { useEffect, useState } from "react";

import { Link, useLocation } from "react-router-dom";
import { all_routes } from "../router/all_routes";
import ImageWithBasePath from "../../core/common/imageWithBasePath";
import { OverlayTrigger, Tooltip, Modal } from "react-bootstrap";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { DatePicker } from "antd";
import PerfectScrollbar from "react-perfect-scrollbar";
import "../../../node_modules/react-perfect-scrollbar/dist/css/styles.css";
import React from "react";
import { useSelector } from "react-redux";
import { useChats, useChatMessages } from "../../core/hooks/useChats";
import { selectUser } from "../../core/data/redux/authSlice";
import { apiService } from "../../core/services/apiService";

const Chat = () => {
  const { chats, loading, error, refetch: refetchChats } = useChats();
  const currentUser = useSelector(selectUser);
  const currentUserId = currentUser?.id;
  const [selectedChat, setSelectedChat] = React.useState<any>(null);
  const { messages, loading: messagesLoading, refetch: refetchMessages } = useChatMessages(selectedChat?.recipient_id);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [chatUsers, setChatUsers] = useState<any[]>([]);
  const [chatUsersLoading, setChatUsersLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showViewAllModal, setShowViewAllModal] = useState<"all" | "pinned" | null>(null);
  const [showAllChatSearch, setShowAllChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [contactProfile, setContactProfile] = useState<any>(null);
  const [sharedMedia, setSharedMedia] = useState<any[]>([]);
  
  // Group chats by pinned status, filter by search
  const filterBySearch = (chat: any) => {
    if (!chatSearchQuery.trim()) return true;
    const q = chatSearchQuery.trim().toLowerCase();
    const name =
      `${chat.recipient_username || ""} ${chat.recipient_first_name || ""} ${chat.recipient_last_name || ""}`.toLowerCase();
    const msg = (chat.last_message || "").toLowerCase();
    return name.includes(q) || msg.includes(q);
  };
  const pinnedChats = chats.filter(
    (chat: any) => chat.is_pinned && filterBySearch(chat)
  );
  const recentChats = chats.filter(
    (chat: any) => filterBySearch(chat)
  );
  
  const formatTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const now = new Date();
    
    // Compare dates (year, month, day) - ignore time
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const diffTime = today.getTime() - messageDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // Same day - show only time
      return timeStr;
    } else if (diffDays === 1) {
      // Yesterday
      return `Yesterday, ${timeStr}`;
    } else {
      // Older - show date and time
      return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${timeStr}`;
    }
  };

  const useBodyClass = (className: string) => {
    const location = useLocation();

    useEffect(() => {
      if (location.pathname === "/application/chat") {
        document.body.classList.add(className);
      } else {
        document.body.classList.remove(className);
      }
      return () => {
        document.body.classList.remove(className);
      };
    }, [location.pathname, className]);
  };
  useBodyClass("app-chat");

  useEffect(() => {
    if (!selectedChat?.recipient_id) {
      setContactProfile(null);
      setSharedMedia([]);
      return;
    }
    const fetchContact = async () => {
      try {
        const res = await apiService.getUserById(selectedChat.recipient_id);
        setContactProfile(res?.data || null);
      } catch {
        setContactProfile(null);
      }
    };
    const fetchMedia = async () => {
      try {
        const res = await apiService.getSharedMedia(selectedChat.recipient_id);
        setSharedMedia(res?.data || []);
      } catch {
        setSharedMedia([]);
      }
    };
    fetchContact();
    fetchMedia();
  }, [selectedChat?.recipient_id]);

  const sharedPhotos = sharedMedia.filter((m: any) => m.message_type === "image");
  const sharedVideos = sharedMedia.filter((m: any) => m.message_type === "video");
  const sharedFiles = sharedMedia.filter((m: any) => m.message_type === "file");

  const routes = all_routes;
  const [open1, setOpen1] = React.useState(false);
  const [open2, setOpen2] = React.useState(false);

  const [isShow, setShow] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showEmoji2, setShowEmoji2] = useState(false);
  const [isVisible, setIsVisible] = useState(false);



  const handleShowClass = () => {
    setShow(true);
  };

  const handleShowremoveClass = () => {
    setShow(false);
  };

  const handleAddVisible = () => {
    setIsVisible(true);
  };

  const handleRemoveVisible = () => {
    setIsVisible(false);
  };

  const openNewChatModal = async () => {
    setShowNewChatModal(true);
    setChatUsersLoading(true);
    try {
      const res = await apiService.getUsers();
      const users = (res.data || []).filter((u: any) => u.id !== currentUserId);
      setChatUsers(users);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setChatUsers([]);
    } finally {
      setChatUsersLoading(false);
    }
  };

  const startNewChat = (user: any) => {
    setSelectedChat({
      recipient_id: user.id,
      recipient_username: user.username,
      recipient_first_name: user.first_name,
      recipient_last_name: user.last_name,
      recipient_email: user.email,
      recipient_phone: user.phone || user.mobile,
      recipient_photo_url: null,
      last_message: null,
      last_message_time: null,
    });
    setShowNewChatModal(false);
  };

  const handleTogglePin = async (e: React.MouseEvent, recipientId: string | number, currentlyPinned: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await apiService.updateChatConversationPin(String(recipientId), !currentlyPinned);
      refetchChats();
    } catch (err) {
      console.error("Failed to toggle pin:", err);
      alert("Failed to pin/unpin. Please try again.");
    }
  };

  const handleMuteNotification = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await apiService.muteConversation(String(selectedChat.recipient_id), true);
      alert("Notifications muted for this chat.");
    } catch (err) {
      console.error("Failed to mute:", err);
      alert("Failed to mute notifications.");
    }
  };

  const handleDisappearingMessage = (e: React.MouseEvent) => {
    e.preventDefault();
    alert("Disappearing messages – coming soon.");
  };

  const handleClearMessage = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Clear all messages? Messages will be permanently deleted from the database.")) return;
    try {
      await apiService.clearConversation(String(selectedChat.recipient_id));
      setSelectedChat(null);
      await refetchChats();
      await refetchMessages();
      alert("Chat cleared.");
    } catch (err) {
      console.error("Failed to clear chat:", err);
      alert("Failed to clear chat.");
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Delete this chat? All messages will be permanently removed.")) return;
    try {
      await apiService.deleteConversation(String(selectedChat.recipient_id));
      setSelectedChat(null);
      await refetchChats();
      alert("Chat deleted.");
    } catch (err) {
      console.error("Failed to delete chat:", err);
      alert("Failed to delete chat.");
    }
  };

  const handleReport = async (e: React.MouseEvent) => {
    e.preventDefault();
    const reason = prompt("Reason for report (optional):");
    if (reason === null) return; // user cancelled
    try {
      await apiService.reportUser(String(selectedChat.recipient_id), reason || "");
      alert("Report submitted. Thank you.");
    } catch (err) {
      console.error("Failed to report:", err);
      alert("Failed to submit report.");
    }
  };

  const handleBlock = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Block this user? You won't see their chats anymore.")) return;
    try {
      await apiService.blockUser(String(selectedChat.recipient_id));
      setSelectedChat(null);
      await refetchChats();
      alert("User blocked.");
    } catch (err) {
      console.error("Failed to block:", err);
      alert("Failed to block user.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = messageInput?.trim();
    if (!msg || !selectedChat?.recipient_id || sending) return;
    setSending(true);
    try {
      await apiService.createChat({
        recipient_id: selectedChat.recipient_id,
        message: msg,
      });
      setMessageInput("");
      await refetchMessages();
      await refetchChats();
      setSelectedChat((prev: any) =>
        prev ? { ...prev, last_message: msg, last_message_time: new Date().toISOString() } : prev
      );
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };
  const profile = {
    loop: true,
    margin: 15,
    items: 5,
    nav: false,
    dots: false,
    autoplay: false,
    slidesToShow: 5,
    speed: 500,
    responsive: [
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 5,
        },
      },
      {
        breakpoint: 800,
        settings: {
          slidesToShow: 4,
        },
      },
      {
        breakpoint: 776,
        settings: {
          slidesToShow: 4,
        },
      },
      {
        breakpoint: 567,
        settings: {
          slidesToShow: 3,
        },
      },
    ],
  };

  return (
    <>
      <div className="main-chat-blk">
        <div className="main-wrapper">
          <div className="page-wrapper chat-page-wrapper">
            <div className="content">
              {/* sidebar group */}
              <div className="sidebar-group left-sidebar chat_sidebar">
                {/* Chats sidebar */}
          
                <div
                  id="chats"
                  className="left-sidebar-wrap sidebar active slimscroll"
                >
                
                    <div className="slimscroll-active-sidebar">
                      {/* Left Chat Title */}
                      <div className="left-chat-title all-chats d-flex justify-content-between align-items-center">
                        <div className="setting-title-head d-flex align-items-center gap-2">
                          <h4 className="mb-0">All Chats</h4>
                          <Link
                            to="#"
                            className="btn btn-sm btn-outline-primary"
                            onClick={(e) => {
                              e.preventDefault();
                              openNewChatModal();
                            }}
                          >
                            <i className="bx bx-message-rounded-add me-1" />
                            New Chat
                          </Link>
                        </div>
                        <div className="add-section">
                          <ul>
                            <li>
                              <Link
                                to="#"
                                className="user-chat-search-btn"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setShowAllChatSearch((prev) => !prev);
                                }}
                              >
                                <i className="bx bx-search" />
                              </Link>
                            </li>
                            <li>
                              <div className="chat-action-btns">
                                <div className="chat-action-col">
                                  <Link
                                    className="#"
                                    to="#"
                                    data-bs-toggle="dropdown"
                                    aria-expanded="false"
                                  >
                                    <i className="bx bx-dots-vertical-rounded" />
                                  </Link>
                                  <div className="dropdown-menu dropdown-menu-end">
                                    <Link
                                      to="#"
                                      className="dropdown-item"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        openNewChatModal();
                                      }}
                                    >
                                      <span>
                                        <i className="bx bx-message-rounded-add" />
                                      </span>
                                      New Chat
                                    </Link>
                                    <Link
                                      to="#"
                                      className="dropdown-item"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        alert("Create Group – coming soon.");
                                      }}
                                    >
                                      <span>
                                        <i className="bx bx-user-circle" />
                                      </span>
                                      Create Group
                                    </Link>
                                    <Link
                                      to="#"
                                      className="dropdown-item"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        alert("Invite Others – coming soon.");
                                      }}
                                    >
                                      <span>
                                        <i className="bx bx-user-plus" />
                                      </span>
                                      Invite Others
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </li>
                          </ul>
                          {/* Chat Search */}
                          <div
                            className={`user-chat-search ${showAllChatSearch ? "visible-chat" : ""}`}
                          >
                            <form onSubmit={(e) => e.preventDefault()}>
                              <span className="form-control-feedback">
                                <i className="bx bx-search" />
                              </span>
                              <input
                                type="text"
                                name="chat-search"
                                placeholder="Search"
                                className="form-control"
                                value={chatSearchQuery}
                                onChange={(e) => setChatSearchQuery(e.target.value)}
                              />
                              <div
                                className="user-close-btn-chat"
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setShowAllChatSearch(false);
                                  setChatSearchQuery("");
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    setShowAllChatSearch(false);
                                    setChatSearchQuery("");
                                  }
                                }}
                              >
                                <span className="material-icons">close</span>
                              </div>
                            </form>
                          </div>
                          {/* /Chat Search */}
                        </div>
                      </div>
                      {/* /Left Chat Title */}
                      {/* Top Online Contacts */}
                      <div className="top-online-contacts p-4 pb-0">
                        <div className="fav-title">
                          <h5>Online Now</h5>
                          <Link
                            to="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowViewAllModal("all");
                            }}
                          >
                            View All
                          </Link>
                        </div>
                        {chats.length === 0 ? (
                          <div className="text-muted small py-2">No chats yet. Start a new chat!</div>
                        ) : (
                          <div className="d-flex flex-row flex-nowrap gap-2 overflow-auto pb-2">
                            {chats.slice(0, 8).map((chat: any) => (
                              <div
                                key={chat.id}
                                className="top-contacts-box flex-shrink-0"
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedChat(chat)}
                              >
                                <div className="avatar avatar-lg avatar-online">
                                  <ImageWithBasePath
                                    src={chat.recipient_photo_url || "assets/img/profiles/avatar-01.jpg"}
                                    className="rounded-circle"
                                    alt=""
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* /Top Online Contacts */}
                      <div className="sidebar-body chat-body" id="chatsidebar">
                        {/* Left Chat Title */}
                        {/* <div className="d-flex justify-content-between align-items-center ps-0 pe-0">
                          <div className="fav-title pin-chat">
                            <h5>Pinned Chat</h5>
                          </div>
                        </div> */}
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h5 className="mb-0">Pinned Chat</h5>
                          {pinnedChats.length > 0 && (
                            <Link
                              to="#"
                              className="text-primary small"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowViewAllModal("pinned");
                              }}
                            >
                              View All
                            </Link>
                          )}
                        </div>
                        {/* /Left Chat Title */}
                        <>
                          {loading ? (
                            <div className="text-center p-4">Loading...</div>
                          ) : error ? (
                            <div className="text-center p-4 text-danger">Error: {error}</div>
                          ) : (
                            <>
                              {pinnedChats.length > 0 && (
                                <ul className="mb-3">
                                  {pinnedChats.map((chat: any) => (
                                    <li key={chat.id} className="user-list-item">
                                      <Link
                                        to="#"
                                        className={`p-2 border rounded d-block mb-2 ${selectedChat?.recipient_id === chat.recipient_id ? 'bg-light' : ''}`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setSelectedChat(chat);
                                        }}
                                      >
                                        <div className="d-flex align-items-center">
                                          <div className={`avatar avatar-lg ${chat.is_online ? 'avatar-online' : ''} me-2 flex-shrink-0`}>
                                            <ImageWithBasePath
                                              src={chat.recipient_photo_url || "assets/img/profiles/avatar-01.jpg"}
                                              className="rounded-circle"
                                              alt="image"
                                            />
                                          </div>
                                          <div className="flex-grow-1 overflow-hidden me-2">
                                            <h6 className="mb-1 text-truncate">
                                              {chat.recipient_username || chat.recipient_name || 'Unknown'}
                                            </h6>
                                            <p className="text-truncate">
                                              {chat.last_message || 'No messages'}
                                            </p>
                                          </div>
                                          <div className="flex-shrink-0 align-self-start text-end">
                                            <small className="text-muted">
                                              {formatTime(chat.last_message_time || chat.updated_at)}
                                            </small>
                                            <div className="d-flex align-items-center justify-content-end gap-1">
                                              <OverlayTrigger placement="top" overlay={<Tooltip id={`pin-${chat.recipient_id}`}>Unpin</Tooltip>}>
                                                <button
                                                  type="button"
                                                  className="btn btn-link btn-sm p-0 text-primary"
                                                  onClick={(e) => handleTogglePin(e, chat.recipient_id, true)}
                                                >
                                                  <i className="bx bxs-pin" />
                                                </button>
                                              </OverlayTrigger>
                                              {chat.is_read && <i className="bx bx-check-double" />}
                                            </div>
                                          </div>
                                        </div>
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {/* Left Chat Title */}
                              <h5 className="mb-3">Recent Chat</h5>
                              {/* /Left Chat Title */}
                              <ul className="user-list">
                                {recentChats.length === 0 ? (
                                  <li className="text-center p-4 text-muted">No chats found</li>
                                ) : (
                                  recentChats.map((chat: any) => (
                                    <li key={chat.id} className="user-list-item">
                                      <Link
                                        to="#"
                                        className={`p-2 border rounded d-block mb-2 ${selectedChat?.recipient_id === chat.recipient_id ? 'bg-light' : ''}`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setSelectedChat(chat);
                                        }}
                                      >
                                        <div className="d-flex align-items-center">
                                          <div className={`avatar avatar-lg ${chat.is_online ? 'avatar-online' : ''} me-2 flex-shrink-0`}>
                                            <ImageWithBasePath
                                              src={chat.recipient_photo_url || "assets/img/profiles/avatar-01.jpg"}
                                              className="rounded-circle"
                                              alt="image"
                                            />
                                          </div>
                                          <div className="flex-grow-1 overflow-hidden me-2">
                                            <h6 className="mb-1 text-truncate">
                                              {chat.recipient_username || chat.recipient_name || 'Unknown'}
                                            </h6>
                                            <p className="text-truncate">
                                              {chat.last_message || 'No messages'}
                                            </p>
                                          </div>
                                          <div className="flex-shrink-0 align-self-start text-end">
                                            <small className="text-muted">
                                              {formatTime(chat.last_message_time || chat.updated_at)}
                                            </small>
                                            <div className="d-flex align-items-center justify-content-end gap-1 flex-wrap">
                                              <OverlayTrigger placement="top" overlay={<Tooltip id={`pin-${chat.recipient_id}`}>Pin chat</Tooltip>}>
                                                <button
                                                  type="button"
                                                  className="btn btn-link btn-sm p-0 text-muted"
                                                  onClick={(e) => handleTogglePin(e, chat.recipient_id, false)}
                                                >
                                                  <i className="bx bx-pin" />
                                                </button>
                                              </OverlayTrigger>
                                              {chat.unread_count > 0 && (
                                                <span className="badge bg-primary rounded-circle p-1 fs-8">
                                                  {chat.unread_count}
                                                </span>
                                              )}
                                              {chat.unread_count === 0 && chat.is_read && (
                                                <i className="bx bx-check-double" />
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </Link>
                                    </li>
                                  ))
                                )}
                              </ul>
                            </>
                          )}
                        </>
                      </div>
                    </div>
             
                </div>
               
                {/* / Chats sidebar */}
              </div>
              {/* /Sidebar group */}

              {/* Chat */}
              <div className="chat chat-messages" id="middle">
                <div className="slimscroll">
                  <PerfectScrollbar>
                    {!selectedChat ? (
                      <div className="d-flex flex-column align-items-center justify-content-center p-5" style={{ minHeight: "400px" }}>
                        <i className="bx bx-message-dots display-4 text-muted mb-3" />
                        <h5 className="text-muted">Select a chat to start</h5>
                        <p className="text-muted small">Choose a conversation from the list or start a new one</p>
                      </div>
                    ) : (
                    <>
                    <div className="chat-header">
                      <div className="user-details">
                        <div className="d-lg-none">
                          <ul className="list-inline mt-2 me-2">
                            <li className="list-inline-item">
                              <Link
                                className="text-muted px-0 left_sides"
                                to="#"
                                data-chat="open"
                              >
                                <i className="fas fa-arrow-left" />
                              </Link>
                            </li>
                          </ul>
                        </div>
                        <div className="avatar avatar-lg me-2">
                          <ImageWithBasePath
                            src={selectedChat.recipient_photo_url || "assets/img/profiles/avatar-01.jpg"}
                            className="rounded-circle"
                            alt="image"
                          />
                        </div>
                        <div>
                          <h6>
                            {selectedChat.recipient_username || `${selectedChat.recipient_first_name || ''} ${selectedChat.recipient_last_name || ''}`.trim() || 'Unknown'}
                          </h6>
                          <small className="last-seen">
                            Last message: {formatTime(selectedChat.last_message_time || selectedChat.updated_at)}
                          </small>
                        </div>
                      </div>
                      <div className="chat-options ">
                        <ul className="list-inline">
                          <li className="list-inline-item">
                            <Link
                              to="#"
                              className="btn btn-outline-light chat-search-btn"
                              data-bs-toggle="tooltip"
                              data-bs-placement="bottom"
                              title="Search"
                              onClick={handleShowClass}
                            >
                              <i className="bx bx-search" />
                            </Link>
                          </li>
                          <li className="list-inline-item dropdown">
                            <OverlayTrigger placement="bottom" overlay={<Tooltip id="make-call-tooltip">Make Call</Tooltip>}>
                              <button
                                type="button"
                                className="btn btn-outline-light dropdown-toggle"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                              >
                                <i className="bx bx-phone-call" />
                                <span className="d-none d-md-inline ms-1">Make Call</span>
                              </button>
                            </OverlayTrigger>
                            <div className="dropdown-menu dropdown-menu-end">
                              <Link to={routes.videoCall} state={{ recipient: selectedChat }} className="dropdown-item">
                                <i className="bx bx-video me-2" />
                                Video Call
                              </Link>
                              <Link to={routes.audioCall} state={{ recipient: selectedChat }} className="dropdown-item">
                                <i className="bx bx-phone me-2" />
                                Voice Call
                              </Link>
                              <Link to={routes.conferenceCall} state={{ recipient: selectedChat }} className="dropdown-item">
                                <i className="bx bx-group me-2" />
                                Conference Call
                              </Link>
                            </div>
                          </li>
                          <li className="list-inline-item dream_profile_menu">
                            <Link
                              to="#"
                              className="btn btn-outline-light not-chat-user"
                              onClick={handleAddVisible}
                            >
                              <i className="bx bx-info-circle" />
                            </Link>
                          </li>
                          <li className="list-inline-item">
                            <Link
                              className="btn btn-outline-light no-bg"
                              to="#"
                              data-bs-toggle="dropdown"
                            >
                              <i className="bx bx-dots-vertical-rounded" />
                            </Link>
                            <div className="dropdown-menu dropdown-menu-end">
                              <Link
                                to="#"
                                className="dropdown-item"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedChat(null);
                                }}
                              >
                                <span>
                                  <i className="bx bx-x" />
                                </span>
                                Close Chat
                              </Link>
                              <div className="dropdown-divider" />
                              <Link to={routes.videoCall} state={{ recipient: selectedChat }} className="dropdown-item">
                                <span><i className="bx bx-video" /></span>
                                Video Call
                              </Link>
                              <Link to={routes.audioCall} state={{ recipient: selectedChat }} className="dropdown-item">
                                <span><i className="bx bx-phone" /></span>
                                Voice Call
                              </Link>
                              <Link to={routes.conferenceCall} state={{ recipient: selectedChat }} className="dropdown-item">
                                <span><i className="bx bx-group" /></span>
                                Conference Call
                              </Link>
                              <Link
                                to="#"
                                className="dropdown-item"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleTogglePin(e, String(selectedChat.recipient_id), selectedChat.is_pinned);
                                }}
                              >
                                <span>
                                  <i className={selectedChat.is_pinned ? "bx bxs-pin" : "bx bx-pin"} />
                                </span>
                                {selectedChat.is_pinned ? "Unpin Chat" : "Pin Chat"}
                              </Link>
                              <Link
                                to="#"
                                className="dropdown-item"
                                onClick={(e) => { e.preventDefault(); handleMuteNotification(e); }}
                              >
                                <span>
                                  <i className="bx bx-volume-mute" />
                                </span>
                                Mute Notification
                              </Link>
                              <Link
                                to="#"
                                className="dropdown-item"
                                onClick={(e) => { e.preventDefault(); handleDisappearingMessage(e); }}
                              >
                                <span>
                                  <i className="bx bx-time-five" />
                                </span>
                                Disappearing Message
                              </Link>
                              <Link
                                to="#"
                                className="dropdown-item"
                                onClick={(e) => { e.preventDefault(); handleClearMessage(e); }}
                              >
                                <span>
                                  <i className="bx bx-brush-alt" />
                                </span>
                                Clear Message
                              </Link>
                              <Link
                                to="#"
                                className="dropdown-item"
                                onClick={(e) => { e.preventDefault(); handleDeleteChat(e); }}
                              >
                                <span>
                                  <i className="bx bx-trash-alt" />
                                </span>
                                Delete Chat
                              </Link>
                              <Link
                                to="#"
                                className="dropdown-item"
                                onClick={(e) => { e.preventDefault(); handleReport(e); }}
                              >
                                <span>
                                  <i className="bx bx-dislike" />
                                </span>
                                Report
                              </Link>
                              <Link
                                to="#"
                                className="dropdown-item"
                                onClick={(e) => { e.preventDefault(); handleBlock(e); }}
                              >
                                <span>
                                  <i className="bx bx-block" />
                                </span>
                                Block
                              </Link>
                            </div>
                          </li>
                        </ul>
                      </div>
                      {/* Chat Search */}
                      <div
                        className={
                          isShow ? "chat-search visible-chat" : "chat-search"
                        }
                      >
                        <form>
                          <span
                            className="form-control-feedback"
                            onClick={handleShowClass}
                          >
                            <i className="bx bx-search" />
                          </span>
                          <input
                            type="text"
                            name="chat-search"
                            placeholder="Search Chats"
                            className="form-control"
                          />
                          <div
                            className="close-btn-chat"
                            onClick={handleShowremoveClass}
                          >
                            <i className="fa fa-close" />
                          </div>
                        </form>
                      </div>
                      {/* /Chat Search */}
                    </div>

                    <div className="chat-body">
                      <div className="messages">
                        {messagesLoading ? (
                          <div className="text-center p-4">Loading messages...</div>
                        ) : messages.length === 0 ? (
                          <div className="text-center p-4 text-muted">No messages yet. Start the conversation!</div>
                        ) : (
                        <>
                        {messages.map((msg: any) => {
                          const isFromMe = currentUserId && msg.user_id === currentUserId;
                          const senderName = msg.sender_username || `${msg.sender_first_name || ''} ${msg.sender_last_name || ''}`.trim() || 'Unknown';
                          return (
                          <div key={msg.id} className={`chats ${isFromMe ? 'chats-right' : ''}`}>
                            <div className="chat-avatar">
                              <ImageWithBasePath
                                src={msg.sender_photo_url || "assets/img/profiles/avatar-01.jpg"}
                                className="rounded-circle dreams_chat"
                                alt=""
                              />
                            </div>
                            <div className="chat-content">
                              <div className="chat-profile-name">
                                <h6>
                                  {senderName}<span>{formatTime(msg.created_at)}</span>
                                </h6>
                            </div>
                            <div className="message-content">
                              {msg.message || ''}
                            </div>
                          </div>
                        </div>
                          );
                        })}
                        </>
                        )}
                      </div>
                    </div>
                    </>
                    )}
                  </PerfectScrollbar>
                </div>
                {selectedChat && (
                <div className="chat-footer">
                  <form onSubmit={handleSendMessage}>
                    <div className="smile-foot">
                      <div className="chat-action-btns">
                        <div className="chat-action-col">
                          <Link
                            className="action-circle"
                            to="#"
                            data-bs-toggle="dropdown"
                          >
                            <i className="bx bx-dots-vertical-rounded" />
                          </Link>
                          <div className="dropdown-menu dropdown-menu-end">
                            <Link to="#" className="dropdown-item ">
                              <span>
                                <i className="bx bx-file" />
                              </span>
                              Document
                            </Link>
                            <Link to="#" className="dropdown-item">
                              <span>
                                <i className="bx bx-camera" />
                              </span>
                              Camera
                            </Link>
                            <Link to="#" className="dropdown-item">
                              <span>
                                <i className="bx bx-image" />
                              </span>
                              Gallery
                            </Link>
                            <Link to="#" className="dropdown-item">
                              <span>
                                <i className="bx bx-volume-full" />
                              </span>
                              Audio
                            </Link>
                            <Link to="#" className="dropdown-item">
                              <span>
                                <i className="bx bx-map" />
                              </span>
                              Location
                            </Link>
                            <Link to="#" className="dropdown-item">
                              <span>
                                <i className="bx bx-user-pin" />
                              </span>
                              Contact
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="smile-foot emoj-action-foot">
                      <Link
                        to="#"
                        className="action-circle"
                        onClick={() => setShowEmoji2(!showEmoji2)}
                      >
                        <i className="bx bx-smile" />
                      </Link>
                      <div
                        className="emoj-group-list-foot down-emoji-circle"
                        onClick={() => setShowEmoji2(false)}
                        style={{ display: showEmoji2 ? "block" : "none" }}
                      >
                        <ul>
                          <li>
                            <Link to="#">
                              <ImageWithBasePath
                                src="assets/img/icons/emoj-icon-01.svg"
                                alt="Icon"
                              />
                            </Link>
                          </li>
                          <li>
                            <Link to="#">
                              <ImageWithBasePath
                                src="assets/img/icons/emoj-icon-02.svg"
                                alt="Icon"
                              />
                            </Link>
                          </li>
                          <li>
                            <Link to="#">
                              <ImageWithBasePath
                                src="assets/img/icons/emoj-icon-03.svg"
                                alt="Icon"
                              />
                            </Link>
                          </li>
                          <li>
                            <Link to="#">
                              <ImageWithBasePath
                                src="assets/img/icons/emoj-icon-04.svg"
                                alt="Icon"
                              />
                            </Link>
                          </li>
                          <li>
                            <Link to="#">
                              <ImageWithBasePath
                                src="assets/img/icons/emoj-icon-05.svg"
                                alt="Icon"
                              />
                            </Link>
                          </li>
                          <li className="add-emoj">
                            <Link to="#">
                              <i className="bx bx-plus" />
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="smile-foot">
                      <Link to="#" className="action-circle">
                        <i className="bx bx-microphone-off" />
                      </Link>
                    </div>
                    <input
                      type="text"
                      className="form-control chat_form"
                      placeholder="Type your message here..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      disabled={sending}
                    />
                    <div className="form-buttons">
                      <button className="btn send-btn" type="submit" disabled={sending}>
                        <i className="bx bx-paper-plane" />
                      </button>
                    </div>
                  </form>
                </div>
                )}
              </div>
              {/* /Chat */}
              {/* Right sidebar */}
              <div
                className={
                  isVisible
                    ? "right-sidebar right_sidebar_profile right-side-contact show-right-sidebar"
                    : "right-sidebar right_sidebar_profile right-side-contact hide-right-sidebar"
                }
                id="middle1"
              >
                <div className="right-sidebar-wrap active">
                  <div className="slimscroll">
                    <PerfectScrollbar>
                      <div className="left-chat-title d-flex justify-content-between align-items-center border-bottom-0">
                        <div className="d-flex align-items-center gap-2">
                          <Link
                            to="#"
                            className="btn btn-link btn-sm p-0 text-muted"
                            onClick={(e) => { e.preventDefault(); handleRemoveVisible(); }}
                            title="Back"
                          >
                            <i className="bx bx-arrow-back" style={{ fontSize: "1.25rem" }} />
                          </Link>
                          <h6 className="fav-title mb-0">Contact Info</h6>
                        </div>
                        <div className="contact-close_call text-end">
                          <Link to="#" className="close_profile close-star">
                            <i className="bx bxs-star" />
                          </Link>
                          <Link
                            to="#"
                            className="close_profile close-trash"
                            onClick={(e) => { e.preventDefault(); handleRemoveVisible(); }}
                            title="Close"
                          >
                            <i className="bx bx-x" style={{ fontSize: "1.25rem" }} />
                          </Link>
                        </div>
                      </div>
                      <div className="sidebar-body">
                        <div className="mt-0 right_sidebar_logo">
                          <div className="text-center right-sidebar-profile">
                            <figure className="avatar avatar-xl mb-3">
                              <ImageWithBasePath
                                src={selectedChat?.recipient_photo_url || "assets/img/profiles/avatar-01.jpg"}
                                className="rounded-circle"
                                alt="image"
                              />
                            </figure>
                            <h5 className="profile-name">
                              {selectedChat ? (selectedChat.recipient_username || `${selectedChat.recipient_first_name || ''} ${selectedChat.recipient_last_name || ''}`.trim() || 'Unknown') : 'Contact Info'}
                            </h5>
                            <div className="last-seen-profile">
                              <span>
                                {selectedChat ? `Last message: ${formatTime(selectedChat.last_message_time || selectedChat.updated_at)}` : 'Select a chat to view'}
                              </span>
                            </div>
                            <div className="chat-options chat-option-profile">
                              <ul className="list-inline">
                                <li className="list-inline-item">
                                  <Link
                                    to={routes.audioCall}
                                    state={{ recipient: selectedChat }}
                                    className="btn btn-outline-light"
                                    data-bs-toggle="tooltip"
                                    data-bs-placement="bottom"
                                    title="Voice Call"
                                  >
                                    <i className="bx bx-phone" />
                                  </Link>
                                </li>
                                <li className="list-inline-item">
                                  <Link
                                    to={routes.videoCall}
                                    state={{ recipient: selectedChat }}
                                    className="btn btn-outline-light"
                                    data-bs-toggle="tooltip"
                                    data-bs-placement="bottom"
                                    title="Video Call"
                                  >
                                    <i className="bx bx-video" />
                                  </Link>
                                </li>
                                <li className="list-inline-item">
                                  <Link
                                    to={routes.conferenceCall}
                                    state={{ recipient: selectedChat }}
                                    className="btn btn-outline-light"
                                    data-bs-toggle="tooltip"
                                    data-bs-placement="bottom"
                                    title="Conference Call"
                                  >
                                    <i className="bx bx-group" />
                                  </Link>
                                </li>
                                <li className="list-inline-item">
                                  <Link
                                    to="#"
                                    className="btn btn-outline-light"
                                    data-bs-toggle="tooltip"
                                    data-bs-placement="bottom"
                                    title="Chat"
                                  >
                                    <i className="bx bx-message-square-dots" />
                                  </Link>
                                </li>
                              </ul>
                            </div>
                          </div>
                          <div className="chat-member-details">
                            <div className="member-details">
                              <ul>
                                <li>
                                  <h5>Bio</h5>
                                  <span>{contactProfile?.bio || "—"}</span>
                                </li>
                                <li>
                                  <h6>Phone</h6>
                                  <span>{contactProfile?.phone || contactProfile?.mobile || selectedChat?.recipient_phone || "—"}</span>
                                </li>
                                <li>
                                  <h6>Email Address</h6>
                                  <span>{contactProfile?.email || selectedChat?.recipient_email || "—"}</span>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="right-sidebar-head share-media">
                        <div className="share-media-blk">
                          <h5>Shared Media</h5>
                          <Link to="#">View All</Link>
                        </div>
                        <div className="about-media-tabs">
                          <nav>
                            <div className="nav nav-tabs " id="nav-tab">
                              <Link
                                className="nav-item nav-link active"
                                id="nav-home-tab"
                                data-bs-toggle="tab"
                                to="#info"
                              >
                                Photos
                              </Link>
                              <Link
                                className="nav-item nav-link"
                                id="nav-profile-tab1"
                                data-bs-toggle="tab"
                                to="#Participants"
                              >
                                Videos
                              </Link>
                              <Link
                                className="nav-item nav-link"
                                id="nav-profile-tab2"
                                data-bs-toggle="tab"
                                to="#media"
                              >
                                File
                              </Link>
                              <Link
                                className="nav-item nav-link"
                                id="nav-profile-tab3"
                                data-bs-toggle="tab"
                                to="#link"
                              >
                                Link
                              </Link>
                            </div>
                          </nav>
                          <div className="tab-content pt-0" id="nav-tabContent">
                            <div
                              className="tab-pane fade show active"
                              id="info"
                            >
                              <ul className="nav share-media-img mb-0">
                                <Lightbox
                                  open={open2}
                                  close={() => setOpen2(false)}
                                  slides={sharedPhotos.length > 0
                                    ? sharedPhotos.slice(0, 10).map((m: any) => ({
                                        src: m.file_url?.startsWith("http") ? m.file_url : (m.file_url?.startsWith("/") ? m.file_url : `/${m.file_url}`),
                                      }))
                                    : [{ src: "" }]}
                                />
                                {sharedPhotos.length === 0 ? (
                                  <li className="text-muted small">No photos shared yet</li>
                                ) : (
                                  sharedPhotos.slice(0, 6).map((m: any, idx: number) => (
                                    <li key={m.id}>
                                      <Link
                                        onClick={() => setOpen2(true)}
                                        to="#"
                                        data-fancybox="gallery"
                                        className="fancybox"
                                      >
                                        <ImageWithBasePath
                                          src={m.file_url || "assets/img/profiles/avatar-01.jpg"}
                                          alt=""
                                        />
                                      </Link>
                                    </li>
                                  ))
                                )}
                                {sharedPhotos.length > 6 && (
                                  <li className="blur-media">
                                    <Link onClick={() => setOpen2(true)} to="#" className="fancybox">
                                      <ImageWithBasePath
                                        src={sharedPhotos[6]?.file_url || "assets/img/profiles/avatar-01.jpg"}
                                        alt=""
                                      />
                                    </Link>
                                    <span>+{sharedPhotos.length - 6}</span>
                                  </li>
                                )}
                              </ul>
                            </div>
                            <div className="tab-pane fade" id="Participants">
                              <ul className="nav share-media-img mb-0">
                                {sharedVideos.length === 0 ? (
                                  <li className="text-muted small">No videos shared yet</li>
                                ) : (
                                  sharedVideos.slice(0, 6).map((m: any) => (
                                    <li key={m.id}>
                                      <Link to="#">
                                        <ImageWithBasePath
                                          src={m.file_url || "assets/img/profiles/avatar-01.jpg"}
                                          alt="video"
                                        />
                                        <span><i className="bx bx-play-circle" /></span>
                                      </Link>
                                    </li>
                                  ))
                                )}
                              </ul>
                            </div>
                            <div className="tab-pane fade" id="media">
                              {sharedFiles.length === 0 ? (
                                <div className="text-muted small">No files shared yet</div>
                              ) : (
                                sharedFiles.map((m: any) => (
                                  <div key={m.id} className="media-file">
                                    <div className="media-doc-blk">
                                      <span><i className="bx bxs-file" /></span>
                                      <div className="document-detail">
                                        <h6>{(m.file_url || "").split("/").pop() || "File"}</h6>
                                        <ul>
                                          <li>{m.created_at ? new Date(m.created_at).toLocaleDateString("en-GB") : ""}</li>
                                        </ul>
                                      </div>
                                    </div>
                                    <div className="media-download">
                                      <Link to={m.file_url} target="_blank" rel="noopener noreferrer">
                                        <i className="bx bx-download" />
                                      </Link>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="tab-pane fade" id="link">
                              <div className="text-muted small">No links shared yet</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="chat-message-grp">
                        <ul>
                          <li>
                            <Link to="#" className="star-message-left">
                              <div className="stared-group">
                                <span className="star-message">
                                  <i className="bx bx-star" />
                                </span>
                                <h6>Starred Messages</h6>
                              </div>
                              <div className="count-group">
                                <span>0</span>
                                <i className="bx bx-chevron-right" />
                              </div>
                            </Link>
                          </li>
                          <li>
                            <Link to="#" onClick={(e) => { e.preventDefault(); handleMuteNotification(e); }}>
                              <div className="stared-group">
                                <span className="mute-message">
                                  <i className="bx bx-microphone-off" />
                                </span>
                                <h6>Mute Notifications</h6>
                              </div>
                              <div className="count-group">
                                <i className="bx bx-chevron-right" />
                              </div>
                            </Link>
                          </li>
                          <li>
                            <Link to="#" onClick={(e) => { e.preventDefault(); handleBlock(e); }}>
                              <div className="stared-group">
                                <span className="block-message">
                                  <i className="bx bx-x-circle" />
                                </span>
                                <h6>Block User</h6>
                              </div>
                              <div className="count-group">
                                <i className="bx bx-chevron-right" />
                              </div>
                            </Link>
                          </li>
                          <li>
                            <Link to="#" onClick={(e) => { e.preventDefault(); handleReport(e); }}>
                              <div className="stared-group">
                                <span className="report-message">
                                  <i className="bx bx-user-x" />
                                </span>
                                <h6>Report User</h6>
                              </div>
                              <div className="count-group">
                                <i className="bx bx-chevron-right" />
                              </div>
                            </Link>
                          </li>
                          <li>
                            <Link to="#" onClick={(e) => { e.preventDefault(); handleDeleteChat(e); }}>
                              <div className="stared-group">
                                <span className="delete-message">
                                  <i className="bx bx-trash-alt" />
                                </span>
                                <h6>Delete Chat</h6>
                              </div>
                              <div className="count-group">
                                <i className="bx bx-chevron-right" />
                              </div>
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </PerfectScrollbar>
                  </div>
                </div>
              </div>
              {/* Right sidebar */}
            </div>
          </div>

          <div>
            {/* Add Transfer */}
            <div className="modal fade" id="add-units">
              <div className="modal-dialog purchase modal-dialog-centered stock-adjust-modal">
                <div className="modal-content">
                  <div className="page-wrapper-new p-0">
                    <div className="content">
                      <div className="modal-header border-0 custom-modal-header">
                        <div className="page-title">
                          <h4>Add Transfer</h4>
                        </div>
                        <button
                          type="button"
                          className="close"
                          data-bs-dismiss="modal"
                          aria-label="Close"
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                      <div className="modal-body custom-modal-body">
                        <div className="row">
                          <div className="col-lg-4 col-md-6 col-sm-12">
                            <div className="input-blocks">
                              <label>Date</label>
                              <div className="input-groupicon calender-input">
                                <i
                                  data-feather="calendar"
                                  className="info-img"
                                />
                                <input
                                  type="text"
                                  className="datetimepicker form-control"
                                  placeholder="Select Date"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="col-lg-4 col-md-6 col-sm-12">
                            <div className="input-blocks">
                              <label>From</label>
                              <select className="select">
                                <option>Choose</option>
                                <option>Store 1</option>
                              </select>
                            </div>
                          </div>
                          <div className="col-lg-4 col-md-6 col-sm-12">
                            <div className="input-blocks">
                              <label>To</label>
                              <select className="select">
                                <option>Choose</option>
                                <option>Store 2</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div className="row">
                          <div className="col-lg-12">
                            <div className="input-blocks">
                              <label>Product Name</label>
                              <input
                                type="text"
                                placeholder="Please type product code and select"
                              />
                            </div>
                          </div>
                          <div className="col-lg-12">
                            <div className="modal-body-table">
                              <div className="table-responsive">
                                <table className="table  datanew">
                                  <thead>
                                    <tr>
                                      <th>Product</th>
                                      <th>Qty</th>
                                      <th>Purchase Price($)</th>
                                      <th>Discount($)</th>
                                      <th>Tax(%)</th>
                                      <th>Tax Amount($)</th>
                                      <th>Unit Cost($)</th>
                                      <th>Total Cost(%)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td className="p-5" />
                                      <td className="p-5" />
                                      <td className="p-5" />
                                      <td className="p-5" />
                                      <td className="p-5" />
                                      <td className="p-5" />
                                      <td className="p-5" />
                                      <td className="p-5" />
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                          <div className="row">
                            <div className="col-lg-3 col-md-6 col-sm-12">
                              <div className="input-blocks">
                                <label>Order Tax</label>
                                <input type="text" defaultValue={0} />
                              </div>
                            </div>
                            <div className="col-lg-3 col-md-6 col-sm-12">
                              <div className="input-blocks">
                                <label>Discount</label>
                                <input type="text" defaultValue={0} />
                              </div>
                            </div>
                            <div className="col-lg-3 col-md-6 col-sm-12">
                              <div className="input-blocks">
                                <label>Shipping</label>
                                <input type="text" defaultValue={0} />
                              </div>
                            </div>
                            <div className="col-lg-3 col-md-6 col-sm-12">
                              <div className="input-blocks">
                                <label>Status</label>
                                <select className="select">
                                  <option>Choose</option>
                                  <option>Sent</option>
                                  <option>Pending</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-12">
                          <div className="input-blocks summer-description-box">
                            <label>Notes</label>
                            <div id="summernote" />
                          </div>
                        </div>
                        <div className="col-lg-12">
                          <div className="modal-footer-btn">
                            <Link
                              to="#"
                              className="btn btn-cancel me-2"
                              data-bs-dismiss="modal"
                            >
                              Cancel
                            </Link>
                            <Link to="#" className="btn btn-submit">
                              Submit
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Add Transfer */}
            {/* Edit Transfer */}
            <div className="modal fade" id="edit-units">
              <div className="modal-dialog purchase modal-dialog-centered stock-adjust-modal">
                <div className="modal-content">
                  <div className="page-wrapper-new p-0">
                    <div className="content">
                      <div className="modal-header border-0 custom-modal-header">
                        <div className="page-title">
                          <h4>Edit Transfer</h4>
                        </div>
                        <button
                          type="button"
                          className="close"
                          data-bs-dismiss="modal"
                          aria-label="Close"
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                      <div className="modal-body custom-modal-body">
                        <div>
                          <div>
                            <div className="row">
                              <div className="col-lg-4 col-md-6 col-sm-12">
                                <div className="input-blocks">
                                  <label>Date</label>
                                  <div className="input-groupicon calender-input">
                                    <i
                                      data-feather="calendar"
                                      className="info-img"
                                    />
                                    <DatePicker
                                      className="form-control datetimepicker"
                                      placeholder="Select Date"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="col-lg-4 col-md-6 col-sm-12">
                                <div className="input-blocks">
                                  <label>From</label>
                                  <select className="select">
                                    <option>Store 1</option>
                                    <option>Choose</option>
                                  </select>
                                </div>
                              </div>
                              <div className="col-lg-4 col-md-6 col-sm-12">
                                <div className="input-blocks">
                                  <label>To</label>
                                  <select className="select">
                                    <option>Store 2</option>
                                    <option>Choose</option>
                                  </select>
                                </div>
                              </div>
                              <div className="col-lg-12 col-sm-6 col-12">
                                <div className="input-blocks">
                                  <label>Product</label>
                                  <div className="input-groupicon">
                                    <input
                                      type="text"
                                      placeholder="Scan/Search Product by code and select..."
                                    />
                                    <div className="addonset">
                                      <ImageWithBasePath
                                        src="assets/img/icons/scanners.svg"
                                        alt="img"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="row">
                              <div className="col-lg-12">
                                <div className="modal-body-table total-orders">
                                  <div className="table-responsive">
                                    <table className="table">
                                      <thead>
                                        <tr>
                                          <th>Product Name</th>
                                          <th>QTY</th>
                                          <th>Purchase Price($) </th>
                                          <th>Discount($) </th>
                                          <th>Tax %</th>
                                          <th>Tax Amount($)</th>
                                          <th className="text-end">
                                            Unit Cost($)
                                          </th>
                                          <th className="text-end">
                                            Total Cost ($){" "}
                                          </th>
                                          <th />
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr>
                                          <td>
                                            <div className="productimgname">
                                              <Link
                                                to="#"
                                                className="product-img stock-img"
                                              >
                                                <ImageWithBasePath
                                                  src="assets/img/products/stock-img-02.png"
                                                  alt="product"
                                                />
                                              </Link>
                                              <Link to="#">Nike Jordan</Link>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="product-quantity">
                                              <span className="quantity-btn">
                                                +
                                                <i
                                                  data-feather="plus-circle"
                                                  className="plus-circle"
                                                />
                                              </span>
                                              <input
                                                type="text"
                                                className="quntity-input"
                                                defaultValue={10}
                                              />
                                              <span className="quantity-btn">
                                                <i
                                                  data-feather="minus-circle"
                                                  className="feather-search"
                                                />
                                              </span>
                                            </div>
                                          </td>
                                          <td>2000</td>
                                          <td>500.00</td>
                                          <td>0.00</td>
                                          <td>0.00</td>
                                          <td className="text-end">0.00</td>
                                          <td className="text-end">1500</td>
                                          <td>
                                            <Link to="#" className="delete-set">
                                              <ImageWithBasePath
                                                src="assets/img/icons/delete.svg"
                                                alt="svg"
                                              />
                                            </Link>
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="row">
                              <div className="col-lg-12 float-md-right">
                                <div className="total-order">
                                  <ul>
                                    <li>
                                      <h4>Order Tax</h4>
                                      <h5>$ 0.00</h5>
                                    </li>
                                    <li>
                                      <h4>Discount</h4>
                                      <h5>$ 0.00</h5>
                                    </li>
                                    <li>
                                      <h4>Shipping</h4>
                                      <h5>$ 0.00</h5>
                                    </li>
                                    <li className="total">
                                      <h4>Grand Total</h4>
                                      <h5>$1500.00</h5>
                                    </li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                            <div className="row">
                              <div className="col-lg-3 col-sm-6 col-12">
                                <div className="input-blocks">
                                  <label>Order Tax</label>
                                  <input type="text" defaultValue={0} />
                                </div>
                              </div>
                              <div className="col-lg-3 col-sm-6 col-12">
                                <div className="input-blocks">
                                  <label>Discount</label>
                                  <input type="text" defaultValue={0} />
                                </div>
                              </div>
                              <div className="col-lg-3 col-sm-6 col-12">
                                <div className="input-blocks">
                                  <label>Shipping</label>
                                  <input type="text" defaultValue={0} />
                                </div>
                              </div>
                              <div className="col-lg-3 col-sm-6 col-12">
                                <div className="input-blocks">
                                  <label>Status</label>
                                  <select className="select">
                                    <option>Sent</option>
                                    <option>Pending</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-12">
                          <div className="input-blocks summer-description-box">
                            <label>Description</label>
                            <div id="summernote2">
                              <p>
                                These shoes are made with the highest quality
                                materials.{" "}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-12">
                          <div className="modal-footer-btn">
                            <Link
                              to="#"
                              className="btn btn-cancel me-2"
                              data-bs-dismiss="modal"
                            >
                              Cancel
                            </Link>
                            <Link to="#" className="btn btn-submit">
                              Save Changes
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Edit Transfer */}
            {/* Import Purchase */}
            <div className="modal fade" id="view-notes">
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="page-wrapper-new p-0">
                    <div className="content">
                      <div className="modal-header border-0 custom-modal-header">
                        <div className="page-title">
                          <h4>Import Transfer</h4>
                        </div>
                        <button
                          type="button"
                          className="close"
                          data-bs-dismiss="modal"
                          aria-label="Close"
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                      <div className="modal-body custom-modal-body">
                        <div className="row">
                          <div className="col-lg-4 col-sm-6 col-12">
                            <div className="input-blocks">
                              <label>From</label>
                              <select className="select">
                                <option>Choose</option>
                                <option>Store 1</option>
                              </select>
                            </div>
                          </div>
                          <div className="col-lg-4 col-sm-6 col-12">
                            <div className="input-blocks">
                              <label>To</label>
                              <select className="select">
                                <option>Choose</option>
                                <option>Store 2</option>
                              </select>
                            </div>
                          </div>
                          <div className="col-lg-4 col-sm-6 col-12">
                            <div className="input-blocks">
                              <label>Satus</label>
                              <select className="select">
                                <option>Choose</option>
                                <option>Sent</option>
                                <option>Pending</option>
                              </select>
                            </div>
                          </div>
                          <div className="col-lg-12 col-sm-6 col-12">
                            <div className="row">
                              <div>
                                {/* <div class="input-blocks download">
                        <Link class="btn btn-submit">Download Sample File</Link>
                      </div> */}
                                <div className="modal-footer-btn download-file">
                                  <Link to="#" className="btn btn-submit">
                                    Download Sample File
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="col-lg-12">
                            <div className="input-blocks image-upload-down">
                              <label> Upload CSV File</label>
                              <div className="image-upload download">
                                <input type="file" />
                                <div className="image-uploads">
                                  <ImageWithBasePath
                                    src="assets/img/download-img.png"
                                    alt="img"
                                  />
                                  <h4>
                                    Drag and drop a <span>file to upload</span>
                                  </h4>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="col-lg-12 col-sm-6 col-12">
                            <div className="input-blocks">
                              <label>Shipping</label>
                              <input type="text" className="form-control" />
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-12">
                          <div className="input-blocks summer-description-box transfer">
                            <label>Description</label>
                            <div id="summernote3"></div>
                            <p>Maximum 60 Characters</p>
                          </div>
                        </div>
                        <div className="col-lg-12">
                          <div className="modal-footer-btn">
                            <Link
                              to="#"
                              className="btn btn-cancel me-2"
                              data-bs-dismiss="modal"
                            >
                              Cancel
                            </Link>

                            <Link to="#" className="btn btn-submit">
                              Submit
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Import Purchase */}

            {/* View All Chats Modal */}
            <Modal
              show={showViewAllModal !== null}
              onHide={() => setShowViewAllModal(null)}
              centered
            >
              <Modal.Header closeButton>
                <Modal.Title>
                  {showViewAllModal === "pinned" ? "Pinned Chats" : "All Chats"}
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                {(() => {
                  const list =
                    showViewAllModal === "pinned" ? pinnedChats : [...pinnedChats, ...recentChats];
                  if (list.length === 0) {
                    return (
                      <div className="text-center p-4 text-muted">
                        No chats found. Start a new chat!
                      </div>
                    );
                  }
                  return (
                    <div className="list-group list-group-flush">
                      {list.map((chat: any) => (
                        <button
                          key={chat.id}
                          type="button"
                          className="list-group-item list-group-item-action d-flex align-items-center"
                          onClick={() => {
                            setSelectedChat(chat);
                            setShowViewAllModal(null);
                          }}
                        >
                          <div className="avatar avatar-sm me-2">
                            <ImageWithBasePath
                              src={chat.recipient_photo_url || "assets/img/profiles/avatar-01.jpg"}
                              className="rounded-circle"
                              alt=""
                            />
                          </div>
                          <div className="flex-grow-1 text-start">
                            <strong>
                              {chat.recipient_username ||
                                `${chat.recipient_first_name || ""} ${chat.recipient_last_name || ""}`.trim() ||
                                "Unknown"}
                            </strong>
                            <p className="mb-0 small text-muted text-truncate">
                              {chat.last_message || "No messages"}
                            </p>
                          </div>
                          <small className="text-muted">
                            {formatTime(chat.last_message_time || chat.updated_at)}
                          </small>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </Modal.Body>
            </Modal>

            {/* New Chat Modal */}
            <Modal
              show={showNewChatModal}
              onHide={() => setShowNewChatModal(false)}
              centered
            >
              <Modal.Header closeButton>
                <Modal.Title>New Chat</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                {chatUsersLoading ? (
                  <div className="text-center p-4">Loading users...</div>
                ) : chatUsers.length === 0 ? (
                  <div className="text-center p-4 text-muted">No users available</div>
                ) : (
                  <div className="list-group list-group-flush">
                    {chatUsers.map((user: any) => (
                      <button
                        key={user.id}
                        type="button"
                        className="list-group-item list-group-item-action d-flex align-items-center"
                        onClick={() => startNewChat(user)}
                      >
                        <div className="avatar avatar-sm me-2">
                          <ImageWithBasePath
                            src="assets/img/profiles/avatar-01.jpg"
                            className="rounded-circle"
                            alt=""
                          />
                        </div>
                        <div>
                          <strong>
                            {user.username || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "User"}
                          </strong>
                          {user.email && (
                            <small className="d-block text-muted">{user.email}</small>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Modal.Body>
            </Modal>
          </div>
        </div>
      </div>
    </>
  );
};

export default Chat;
