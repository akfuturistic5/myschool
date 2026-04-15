

import { Link } from "react-router-dom";
import Select from "react-select";
import Table from "../../core/common/dataTable/index";
import type { TableData } from "../../core/data/interface";

import ImageWithBasePath from "../../core/common/imageWithBasePath";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import "bootstrap-daterangepicker/daterangepicker.css";
import PredefinedDateRanges from "../../core/common/datePicker";
import { useFiles } from "../../core/hooks/useFiles";
import { useState } from "react";


const FileContent = () => {
  const [parentFolderId, setParentFolderId] = useState<string | undefined>(undefined);
  const { files, loading, error } = useFiles({ parent_folder_id: parentFolderId || 'null' });
  
  // Transform API data to match table format
  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const folderSlider = {
    loop: true,
    margin: 15,
    items: 3,
    nav: true,
    dots: false,
    autoplay: false,
    slidesToShow: 3,
    speed: 500,
    responsive: [
      {
        breakpoint: 1400,
        settings: {
          slidesToShow: 3,
        },
      },
      {
        breakpoint: 1300,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 800,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 776,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 567,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  };

  const fileSlider = {
    loop: true,
    margin: 15,
    items: 3,
    nav: true,
    dots: false,
    autoplay: false,
    slidesToShow: 3,
    speed: 500,
    responsive: [
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 3,
        },
      },
      {
        breakpoint: 800,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 776,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 567,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  };

  const optionsBulk = [
    { value: "bulkActions", label: "Bulk Actions" },
    { value: "deleteMarked", label: "Delete Marked" },
    { value: "unmarkAll", label: "Unmark All" },
    { value: "markAll", label: "Mark All" },
  ];
  const optionsRecent = [
    { value: "recent", label: "Recent" },
    { value: "lastModified", label: "Last Modified" },
    { value: "lastModifiedByMe", label: "Last Modified by me" },
  ];
  
  // Transform API data to match table format
  const data = files.map((file: any) => ({
    id: file.id,
    name: file.name,
    imgSrc: file.is_folder 
      ? "assets/img/icons/folder.svg" 
      : file.mime_type?.startsWith('image/') 
        ? file.file_url || "assets/img/icons/image.svg"
        : file.mime_type === 'application/pdf' 
          ? "assets/img/icons/pdf-02.svg"
          : "assets/img/icons/file.svg",
    lastModified: formatDate(file.updated_at || file.created_at),
    size: file.is_folder ? '-' : formatFileSize(file.size || 0),
    ownedMember: 'Me', // Current user owns the file
    ownedMemberImgSrc: "assets/img/users/user-01.jpg",
    action: "Delete, Edit",
    key: file.id.toString(),
    is_folder: file.is_folder,
    file_url: file.file_url
  }));
  
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      render: (text: string, record: any) => (
        <div className="d-flex align-items-center">
          <Link to="#" className="avatar avatar-md">
            <ImageWithBasePath
              src={record.imgSrc}
              className="img-fluid"
              alt="img"
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link to="#">{text}</Link>
            </p>
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) => a.name.length - b.name.length,
    },
    {
      title: "Last Modified",
      dataIndex: "lastModified",
      sorter: (a: TableData, b: TableData) =>
        new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime(),
    },
    {
      title: "Size",
      dataIndex: "size",
      sorter: (a: TableData, b: TableData) => {
        if (a.size === '-' || b.size === '-') return 0;
        return parseFloat(a.size) - parseFloat(b.size);
      },
    },
    {
      title: "Owned Member",
      dataIndex: "ownedMember",
      render: (text: string, record: any) => (
        <div className="d-flex align-items-center">
          <Link to="#" className="avatar avatar-md">
            <ImageWithBasePath
              src={record.ownedMemberImgSrc}
              className="img-fluid rounded-circle"
              alt="img"
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link to="#">{text}</Link>
            </p>
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) =>
        a.ownedMember.length - b.ownedMember.length,
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (text: string, record: any) => (
        <div className="dropdown">
          <Link
            to="#"
            className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <i className="ti ti-dots-vertical fs-14"></i>
          </Link>
          <ul className="dropdown-menu dropdown-menu-right p-3">
            <li>
              <Link className="dropdown-item rounded-1" to="#">
                <i className="ti ti-trash me-2"></i>
                Delete
              </Link>
            </li>
            <li>
              <Link className="dropdown-item rounded-1" to="#">
                <i className="ti ti-edit-circle me-2"></i>
                Edit
              </Link>
            </li>
          </ul>
        </div>
      ),
    },
  ];
  return (
    <>
      <div className="row">
        <div className="col-12">
          <div className="section-bulks-wrap">
            <div className="bg-white rounded-3 d-flex align-items-center justify-content-between flex-wrap my-4 p-3 pb-0">
              <div className="d-flex align-items-center mb-3">
                <div className="me-3">
                  <Select
                    className="select"
                    options={optionsBulk}
                    classNamePrefix="react-select"
                  />
                </div>
                <Link to="#" className="btn btn-light">
                  Apply
                </Link>
              </div>
              <div className="form-sort mb-3">
                <i className="ti ti-filter feather-filter info-img ms-0" />

                <Select
                  className="select"
                  options={optionsRecent}
                  classNamePrefix="react-select"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* /Overview */}
      <div className="d-block">
        <h4 className="mb-3">Overview</h4>
        <div className="row g-3">
          <div className="col-sm-6 col-md-3">
            <div className="mb-3">
              <Link
                to="#"
                className="d-flex align-items-center justify-content-center bg-light-orange p-3 rounded-top"
              >
                <span className="d-flex align-items-center justify-content-center p-4">
                  <ImageWithBasePath
                    src="assets/img/icons/folder.svg"
                    alt="Folder"
                  />
                </span>
              </Link>
              <div className="d-flex align-items-center justify-content-between p-3 bg-white rounded-bottom">
                <h5>
                  <Link to="#">Folders</Link>
                </h5>
                <span className="text-muted">300 Files</span>
              </div>
            </div>
          </div>
          <div className="col-sm-6 col-md-3">
            <div className="mb-3">
              <Link
                to="#"
                className="d-flex align-items-center justify-content-center bg-light-red p-3 rounded-top"
              >
                <span className="d-flex align-items-center justify-content-center p-4">
                  <ImageWithBasePath
                    src="assets/img/icons/pdf-02.svg"
                    alt="Folder"
                  />
                </span>
              </Link>
              <div className="d-flex align-items-center justify-content-between p-3 bg-white rounded-bottom">
                <h6>
                  <Link to="#">PDF</Link>
                </h6>
                <span>50 Files</span>
              </div>
            </div>
          </div>
          <div className="col-sm-6 col-md-3">
            <div className="mb-3">
              <Link
                to="#"
                className="d-flex align-items-center justify-content-center bg-light-green p-3 rounded-top"
              >
                <span className="d-flex align-items-center justify-content-center p-4">
                  <ImageWithBasePath
                    src="assets/img/icons/image.svg"
                    alt="Folder"
                  />
                </span>
              </Link>
              <div className="d-flex align-items-center justify-content-between p-3 bg-white rounded-bottom">
                <h6>
                  <Link to="#">Images</Link>
                </h6>
                <span>240 Files</span>
              </div>
            </div>
          </div>
          <div className="col-sm-6 col-md-3">
            <div className="mb-3">
              <Link
                to="#"
                className="d-flex align-items-center justify-content-center bg-light-red p-3 rounded-top"
              >
                <span className="d-flex align-items-center justify-content-center p-4">
                  <ImageWithBasePath
                    src="assets/img/icons/video.svg"
                    alt="Folder"
                  />
                </span>
              </Link>
              <div className="d-flex align-items-center justify-content-between p-3 bg-white rounded-bottom">
                <h6>
                  <Link to="#">Videos</Link>
                </h6>
                <span>30 Files</span>
              </div>
            </div>
          </div>
          <div className="col-sm-6 col-md-3">
            <div className="mb-3">
              <Link
                to="#"
                className="d-flex align-items-center justify-content-center bg-light-orange p-3 rounded-top"
              >
                <span className="d-flex align-items-center justify-content-center p-4">
                  <ImageWithBasePath
                    src="assets/img/icons/audio.svg"
                    alt="Folder"
                  />
                </span>
              </Link>
              <div className="d-flex align-items-center justify-content-between p-3 bg-white rounded-bottom">
                <h6>
                  <Link to="#">Audios</Link>
                </h6>
                <span>100 Files</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* /Overview */}
      {/* Filemanager Items */}
      <div className="d-block">
        <div className="mb-4 pb-4 border-bottom">
          <div className="d-flex align-items-center mb-3">
            <h4>Folders</h4>
            <div className="owl-nav slide-nav6 text-end nav-control ms-3" />
          </div>
          {loading ? (
            <div className="text-center p-4">Loading folders...</div>
          ) : error ? (
            <div className="text-center p-4 text-danger">Error: {error}</div>
          ) : files.filter((f: any) => f.is_folder).length === 0 ? (
            <div className="text-center p-4 text-muted">No folders found</div>
          ) : (
          <Slider
            {...folderSlider}
            className="owl-carousel folders-carousel owl-theme"
          >
            {files.filter((f: any) => f.is_folder).map((folder: any) => (
              <div key={folder.id} className="p-3 border p-3 bg-white rounded">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <ImageWithBasePath
                      src="assets/img/icons/folder.svg"
                      alt="Folder"
                      className="me-2"
                    />
                    <h5 className="text-nowrap">
                      <Link to="#" onClick={() => setParentFolderId(folder.id.toString())}>
                        {folder.name}
                      </Link>
                    </h5>
                  </div>
                  <div className="dropdown">
                    <Link
                      to="#"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                      className="dropset"
                    >
                      <i className="fa fa-ellipsis-v" />
                    </Link>
                    <ul className="dropdown-menu">
                      <li>
                        <Link to="#" className="dropdown-item">
                          Details
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item">
                          Share
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item">
                          Copy
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item">
                          Move
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item">
                          Download
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item">
                          Rename
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item">
                          Archive
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item">
                          Delete
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-start my-3">
                  <p className="text-primary mb-0 me-2 pe-1">Folder</p>
                  <span className="d-flex align-items-center fw-semibold me-2">
                    <i className="ti ti-circle-filled fs-5 me-2" />
                    {formatFileSize(folder.size || 0)}
                  </span>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <div className="avatar-list-stacked avatar-group-sm">
                    <span className="fw-semibold mt-2">
                      <Link className="text-success ms-3" to="#">
                        My Folder
                      </Link>
                    </span>
                  </div>
                  {folder.is_shared && (
                    <Link to="#">
                      <i className="ti ti-star fs-16" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </Slider>
          )}
        </div>
        <div className="mb-4 pb-4 border-bottom">
          <div className="d-flex align-items-center mb-3">
            <h4>Files</h4>
            <div className="owl-nav slide-nav7 text-end nav-control ms-3" />
          </div>
          {loading ? (
            <div className="text-center p-4">Loading files...</div>
          ) : error ? (
            <div className="text-center p-4 text-danger">Error: {error}</div>
          ) : files.filter((f: any) => !f.is_folder).length === 0 ? (
            <div className="text-center p-4 text-muted">No files found</div>
          ) : (
          <Slider
            {...fileSlider}
            className="owl-carousel files-carousel owl-theme"
          >
            {files.filter((f: any) => !f.is_folder).slice(0, 6).map((file: any) => {
              const getFileIcon = () => {
                if (file.mime_type === 'application/pdf') return "assets/img/icons/pdf-02.svg";
                if (file.mime_type?.startsWith('image/')) return "assets/img/icons/image.svg";
                if (file.mime_type?.includes('excel') || file.mime_type?.includes('spreadsheet')) return "assets/img/icons/xls.svg";
                if (file.mime_type?.startsWith('video/')) return "assets/img/icons/video.svg";
                return "assets/img/icons/file.svg";
              };
              
              return (
                <div key={file.id} className="border rounded-3 bg-white p-3">
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <ImageWithBasePath
                        src={getFileIcon()}
                        alt="File"
                        className="me-2"
                      />
                      <h5 className="text-nowrap">
                        <Link to="#">{file.name}</Link>
                      </h5>
                    </div>
                    <div className="d-flex align-items-center">
                      {file.is_shared && (
                        <Link to="#">
                          <i className="fa fa-star me-2" />
                        </Link>
                      )}
                      <div className="dropdown">
                        <Link
                          to="#"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                          className="dropset"
                        >
                          <i className="fa fa-ellipsis-v" />
                        </Link>
                        <ul className="dropdown-menu">
                          <li>
                            <Link to="#" className="dropdown-item">
                              Details
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item">
                              Share
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item">
                              Copy
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item">
                              Move
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item">
                              Download
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item">
                              Rename
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item">
                              Archive
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item">
                              Delete
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-start mt-3">
                    <p className="text-primary mb-0 me-2">Last edited {formatDate(file.updated_at || file.created_at)}</p>
                    <span className="d-flex align-items-center fw-semibold me-2">
                      <i className="ti ti-circle-filled fs-5 me-2" />
                      {formatFileSize(file.size || 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </Slider>
          )}
        </div>
        <div className="mb-4 pb-4 border-bottom">
          <div className="d-flex align-items-center mb-3">
            <h4>Videos</h4>
            <div className="owl-nav slide-nav8 text-end nav-control ms-3" />
          </div>
          <div className="owl-carousel video-section d-flex gap-3">
            <div className="items">
              <div className="position-relative">
                <video
                  width={100}
                  height={100}
                  className="js-player w-100"
                  crossOrigin=""
                  playsInline={true}
                  poster="/assets/img/file-manager/video1.jpg"
                >
                  <source
                    src="https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-720p.mp4"
                    type="video/mp4"
                  />
                </video>
                <Link to="#" className="position-absolute play-group">
                  <span className="play-btn-video">
                    <i className="ti ti-player-play-filled" />
                  </span>
                  {/* <span className="pause-btn-video">
                    <i className="ti ti-player-pause" />
                  </span> */}
                </Link>
              </div>
              <div className="bg-white p-3 rounded-bottom">
                <div className="d-flex align-items-center justify-content-between">
                  <h6>
                    <Link to="#">Demo_dw</Link>
                  </h6>
                  <div className="d-flex align-items-center">
                    <Link to="#" className="d-flex align-items-center">
                      <i data-feather="star" className="feather-16 me-2" />
                    </Link>
                    <div className="dropdown">
                      <Link
                        to="#"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        className="dropset"
                      >
                        <i className="fa fa-ellipsis-v" />
                      </Link>
                      <ul className="dropdown-menu">
                        <li>
                          <Link to="#" className="dropdown-item">
                            Details
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Share
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Copy
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Move
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Download
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Rename
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Archeived
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Delete
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-start mt-3">
                  <p className="text-primary mb-0 me-2">Last edited 14 Jul</p>
                  <span className="d-flex align-items-center fw-semibold me-2">
                    <i className="ti ti-circle-filled fs-5 me-2" />
                    150 MB
                  </span>
                </div>
              </div>
            </div>
            <div className="items">
              <div className="position-relative">
                <video
                  className="js-player w-100"
                  crossOrigin=""
                  playsInline={true}
                  poster="/assets/img/file-manager/video2.jpg"
                >
                  <source
                    src="https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-720p.mp4"
                    type="video/mp4"
                  />
                </video>
                <Link to="#" className="position-absolute play-group">
                  <span className="play-btn-video">
                    <i className="ti ti-player-play-filled" />
                  </span>
                  {/* <span className="pause-btn-video">
                    <i className="ti ti-player-pause" />
                  </span> */}
                </Link>
              </div>
              <div className="bg-white p-3 rounded-bottom">
                <div className="d-flex align-items-center justify-content-between">
                  <h6>
                    <Link to="#">Android_bike.mp4</Link>
                  </h6>
                  <div className="d-flex align-items-center">
                    <Link to="#" className="d-flex align-items-center">
                      <i data-feather="star" className="feather-16 me-2" />
                    </Link>
                    <div className="dropdown">
                      <Link
                        to="#"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        className="dropset"
                      >
                        <i className="fa fa-ellipsis-v" />
                      </Link>
                      <ul className="dropdown-menu">
                        <li>
                          <Link to="#" className="dropdown-item">
                            Details
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Share
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Copy
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Move
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Download
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Rename
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Archeived
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Delete
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-start mt-3">
                  <p className="text-primary mb-0 me-2">Last edited 15 Jul</p>
                  <span className="d-flex align-items-center fw-semibold me-2">
                    <i className="ti ti-circle-filled fs-5 me-2" />
                    50 MB
                  </span>
                </div>
              </div>
            </div>
            <div className="items">
              <div className="position-relative">
                <video
                  className="js-player w-100"
                  crossOrigin=""
                  playsInline={true}
                  poster="/assets/img/file-manager/video3.jpg"
                >
                  <source
                    src="https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-720p.mp4"
                    type="video/mp4"
                  />
                </video>
                <Link to="#" className="position-absolute play-group">
                  <span className="play-btn-video">
                    <i className="ti ti-player-play-filled" />
                  </span>
                  {/* <span className="pause-btn-video">
                    <i className="ti ti-player-pause" />
                  </span> */}
                </Link>
              </div>
              <div className="bg-white rounded-bottom p-3">
                <div className="d-flex align-items-center justify-content-between">
                  <h6>
                    <Link to="#">Demoparticles.mp4</Link>
                  </h6>
                  <div className="d-flex align-items-center">
                    <Link to="#" className="d-flex align-items-center">
                      <i data-feather="star" className="feather-16 me-2" />
                    </Link>
                    <div className="dropdown">
                      <Link
                        to="#"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        className="dropset"
                      >
                        <i className="fa fa-ellipsis-v" />
                      </Link>
                      <ul className="dropdown-menu">
                        <li>
                          <Link to="#" className="dropdown-item">
                            Details
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Share
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Copy
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Move
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Download
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Rename
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Archeived
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item">
                            Delete
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-start mt-3">
                  <p className="text-primary mb-0 me-2">Last edited 16 Jul</p>
                  <span className="d-flex align-items-center fw-semibold me-2">
                    <i className="ti ti-circle-filled fs-5 me-2" />
                    250 MB
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* /Filemanager Items */}
      {/* /Filemanager List */}
      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
          <h4 className="mb-3">All Files</h4>
          <div className="d-flex align-items-center flex-wrap">
            <div className="input-icon-start mb-3 me-2 position-relative">
              <PredefinedDateRanges />
            </div>
            <div className="dropdown mb-3">
              <Link
                to="#"
                className="btn btn-outline-light bg-white dropdown-toggle"
                data-bs-toggle="dropdown"
              >
                <i className="ti ti-sort-ascending-2 me-2" />
                Sort by A-Z
              </Link>
              <ul className="dropdown-menu p-3">
                <li>
                  <Link to="#" className="dropdown-item rounded-1">
                    Ascending
                  </Link>
                </li>
                <li>
                  <Link to="#" className="dropdown-item rounded-1">
                    Descending
                  </Link>
                </li>
                <li>
                  <Link to="#" className="dropdown-item rounded-1">
                    Recently Viewed
                  </Link>
                </li>
                <li>
                  <Link to="#" className="dropdown-item rounded-1">
                    Recently Added
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="card-body p-0 py-3">
          {/* Student List */}
          {loading ? (
            <div className="text-center p-4">Loading...</div>
          ) : error ? (
            <div className="text-center p-4 text-danger">Error: {error}</div>
          ) : (
            <Table dataSource={data} columns={columns} Selection={true} />
          )}
          {/* /Student List */}
        </div>
      </div>
      {/* /Filemanager List */}
    </>
  );
};

export default FileContent;
