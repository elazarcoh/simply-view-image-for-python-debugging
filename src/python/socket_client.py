import socket
import sys
import traceback
import struct
import numpy as np

MIN_INT32 = np.iinfo(np.int32).min
MAX_INT32 = np.iinfo(np.int32).max
MIN_UINT32 = np.iinfo(np.uint32).min
MAX_UINT32 = np.iinfo(np.uint32).max
MIN_FLOAT32 = np.finfo(np.float32).min
MAX_FLOAT32 = np.finfo(np.float32).max

DATATYPE_64BIT = ("int64", "uint64", "float64")
CORRESPONDING_32BIT_TYPE = {
    "int64": np.int32,
    "uint64": np.uint32,
    "float64": np.float32,
}

CHUNK_SIZE = 4 * 1024  # 4KB

# See webview/communication/protocol.ts for message format
PythonSender = 0x02
# MessageType
PythonSendingObject = 0x01
# ObjectType
NumpyArray = 0x01
ExceptionObject = 0xFF
# ByteOrderType
LittleEndian = 0x01
BigEndian = 0x02
# ArrayDataType
UndefinedDatatype = 0x00
Float32 = 0x01
Float64 = 0x02
Int8 = 0x03
Int16 = 0x04
Int32 = 0x05
Int64 = 0x06
Uint8 = 0x07
Uint16 = 0x08
Uint32 = 0x09
Uint64 = 0x0A
Bool = 0x0B
# DimensionOrder
HWC = 0x01
CHW = 0x02
# ExceptionType
ExceptionTypes = {
    BaseException: 0x01,
    Exception: 0x02,
    RuntimeError: 0x03,
    TypeError: 0x04,
    ValueError: 0x05,
    None: 0xFF,  # Unknown exception
}

MessageLengthType = np.uint32
MessageIdType = np.uint32
SenderType = np.uint8
MessageType = np.uint8
RequestIdType = np.uint32
ChunkCountType = np.uint32
ChunkIndexType = np.uint32
ChunkLengthType = np.uint32

ObjectIdType = np.uint32
ObjectType = np.uint8
DataTypeType = np.uint8
BoolType = np.uint8
StringLengthType = np.uint32
NumDimsType = np.uint8
DimType = np.uint32
ByteOrderType = np.uint8
DimOrderType = np.uint8
NumStatsType = np.uint8
StatsType = np.float32

array_dtype_to_array_data_type = {
    "float32": Float32,
    "float64": Float64,
    "int8": Int8,
    "int16": Int16,
    "int32": Int32,
    "int64": Int64,
    "uint8": Uint8,
    "uint16": Uint16,
    "uint32": Uint32,
    "uint64": Uint64,
    "bool": Bool,
    "bool_": Bool,
}

BYTE_ORDER = LittleEndian if sys.byteorder == "little" else BigEndian


def generate_message_id():
    rng = np.random.default_rng()
    return rng.integers(0, 2**32, dtype=np.uint32)


def chunk_header(
    message_length,
    message_id,
    request_id,
    chunk_count,
    chunk_index,
    chunk_length,
):
    message_length = MessageLengthType(message_length)
    message_id = MessageIdType(message_id)
    sender = SenderType(PythonSender)
    request_id = RequestIdType(request_id)
    message_type = MessageType(PythonSendingObject)
    chunk_count = ChunkCountType(chunk_count)
    chunk_index = ChunkIndexType(chunk_index)
    chunk_length = ChunkLengthType(chunk_length)

    # Create the message
    header = [
        message_length,
        message_id,
        sender,
        request_id,
        message_type,
        chunk_count,
        chunk_index,
        chunk_length,
    ]
    # print({
    #     'message_length': message_length,
    #     'message_id': message_id,
    #     'sender': sender,
    #     'request_id': request_id,
    #     'message_type': message_type,
    #     'chunk_count': chunk_count,
    #     'chunk_index': chunk_index,
    #     'chunk_length': chunk_length,
    # })

    # Create the message format string
    header_format = f"!IIBIBIII"

    return struct.pack(header_format, *header)


def is_64bit(array):
    return str(array.dtype) in DATATYPE_64BIT


def check_can_fit_in_32bit(array_64bit):
    corresponding_32bit_type = CORRESPONDING_32BIT_TYPE.get(
        str(array_64bit.dtype), None
    )
    if corresponding_32bit_type is None:
        return False
    array_min = np.min(array_64bit)
    array_max = np.max(array_64bit)
    return array_min >= MIN_INT32 and array_max <= MAX_INT32


def guess_image_dimensions(image, is_batched=False):
    if not isinstance(image, np.ndarray):
        return None
    shape = image.shape

    if len(shape) < 2:
        return None

    if len(shape) == 2:
        return {
            "width": DimType(shape[1]),
            "height": DimType(shape[0]),
            "channels": DimType(1),
            "order": DimOrderType(HWC),
        }

    if len(shape) == 4 or is_batched:
        # A batched image
        image = image[0]
        shape = shape[1:]

    if len(shape) == 3:
        if shape[2] > 4:
            # Possibly a channel first image
            if shape[0] > 4:
                return None
            return {
                "width": DimType(shape[2]),
                "height": DimType(shape[1]),
                "channels": DimType(shape[0]),
                "order": DimOrderType(CHW),
            }
        else:
            return {
                "width": DimType(shape[1]),
                "height": DimType(shape[0]),
                "channels": DimType(shape[2]),
                "order": DimOrderType(HWC),
            }

    return None


def array_stats(array):
    if not isinstance(array, np.ndarray):
        return None
    shape = array.shape
    ndims = len(array.shape)

    if ndims < 2:
        return None

    if ndims == 2 or (ndims == 3 and shape[2] == 1):
        return {
            "min": [StatsType(np.nanmin(array))],
            "max": [StatsType(np.nanmax(array))],
        }

    if ndims == 4 and shape[0] == 1:
        # assume batched image
        image = array[0]

    if ndims == 3:
        # per channel stats
        if shape[2] > 4:
            # Possibly a channel first image
            if shape[0] > 4:
                return None
            return {
                "min": StatsType(np.nanmin(array, axis=(1, 2))),
                "max": StatsType(np.nanmax(array, axis=(1, 2))),
            }
        else:
            return {
                "min": StatsType(np.nanmin(array, axis=(0, 1))),
                "max": StatsType(np.nanmax(array, axis=(0, 1))),
            }

    return None


def create_numpy_message(
    array: np.ndarray,
    is_batched=None,
    batch_size=None,
    batch_item_start=None,
    batch_item_stop=None,
):
    object_type = ObjectType(NumpyArray)

    array_dtype = DataTypeType(array_dtype_to_array_data_type[str(array.dtype)])
    actual_datatype = DataTypeType(UndefinedDatatype)
    byte_order = ByteOrderType(BYTE_ORDER)
    num_dimensions = NumDimsType(len(array.shape))
    array_shape = np.array(array.shape, dtype=DimType)

    dimensions = guess_image_dimensions(array) or {}
    w = dimensions.get("width", DimType(0))
    h = dimensions.get("height", DimType(0))
    c = dimensions.get("channels", DimType(0))
    order = dimensions.get("order", None)

    is_batched = BoolType(is_batched or False)
    batch_size = DimType(batch_size or 1)
    batch_item_start = DimType(batch_item_start or 0)
    batch_item_stop = DimType(batch_item_stop or 1)

    stats = array_stats(array) or {}
    min_stats = stats.get("min", [])
    max_stats = stats.get("max", [])
    assert len(min_stats) == len(max_stats)
    num_stats = NumStatsType(len(min_stats))

    # The webview only supports up to 32 bit integers and floats. If the array is 64 bit, try to convert it to 32 bit.
    if is_64bit(array) and check_can_fit_in_32bit(array):
        array = array.astype(CORRESPONDING_32BIT_TYPE[str(array.dtype)])
        actual_datatype = array_dtype_to_array_data_type[str(array.dtype)]

    array_data = array.tobytes("C")

    metadata = [
        object_type,
        array_dtype,
        actual_datatype,
        byte_order,
        num_dimensions,
        *array_shape,
        w,
        h,
        c,
        order,
        # batch info
        is_batched,
        batch_size,
        batch_item_start,
        batch_item_stop,
        # stats
        num_stats,
        *min_stats,
        *max_stats,
    ]

    # add padding before the array data, making sure the offset is a multiple of the element size
    # metadata_size = 1 + 1 + 1 + 1 + num_dimensions * 4
    # bytes_per_element = array.dtype.itemsize
    # message_length_placeholder = 4
    # padding_size =  (bytes_per_element - (header_size + message_length_placeholder) % bytes_per_element) % bytes_per_element
    # padding = bytes(padding_size)

    message = [
        *metadata,
        array_data,
    ]

    # Create the message format string
    message_format = (
        "!"
        "B"  # object_type
        "B"  # array_dtype
        "B"  # actual_datatype
        "B"  # byte_order
        "B"  # num_dimensions
        f"{num_dimensions}I"  # array_shape
        "I"  # w
        "I"  # h
        "I"  # c
        "B"  # order
        "B"  # is_batched
        "I"  # batch_size
        "I"  # batch_item_start
        "I"  # batch_item_stop
        "B"  # num_stats
        f"{num_stats}f"  # min_stats
        f"{num_stats}f"  # max_stats
        f"{len(array_data)}s"  # array_data
    )

    # Pack the message
    message_pack = struct.pack(message_format, *message)

    return message_pack


def create_pillow_message(
    image,
):
    image_np = np.asarray(image)
    return create_numpy_message(image_np)


def element_size(arr):
    if _Internal.is_numpy_array(arr):
        return arr.dtype.itemsize
    elif _Internal.is_torch(arr):
        return arr.element_size()
    else:
        raise ValueError(f"Unsupported array type {type(arr)}")


def numel(arr):
    if _Internal.is_numpy_array(arr):
        return arr.size
    elif _Internal.is_torch(arr):
        return arr.numel()
    else:
        raise ValueError(f"Unsupported array type {type(arr)}")


def create_tensor_message(
    tensor,
    options,
):
    options = options or {}
    MB = 1024 * 1024

    arr_element_size = element_size(tensor)
    num_elements_per_batch_item = numel(tensor[0])
    arr_size_bytes = arr_element_size * numel(tensor)
    max_size_bytes = min(options.get("max_size_bytes", 1 * MB), arr_size_bytes)
    num_bytes_per_batch_item = arr_element_size * num_elements_per_batch_item
    max_num_items_to_send = max(1, max_size_bytes // num_bytes_per_batch_item)

    batch_size = tensor.shape[0]
    start = options.get("start", 0)
    stop = options.get("stop", start + max_num_items_to_send)

    start = max(0, min(start, batch_size))
    stop = max(0, min(stop, batch_size))

    sliced_tensor = tensor[start:stop]
    if _Internal.is_torch(sliced_tensor):
        sliced_tensor = _Internal.torch_to_numpy(sliced_tensor)

    return create_numpy_message(
        sliced_tensor,
        is_batched=True,
        batch_size=batch_size,
        batch_item_start=start,
        batch_item_stop=stop,
    )


def string_to_message(s):
    length = StringLengthType(len(s))
    bytes = s.encode()
    return (length, bytes)


def create_exception_message(
    exception: Exception,
):
    exception_type_name = getattr(type(exception), "__name__", "Unknown")
    exception_message = str(exception)

    object_type = ObjectType(ExceptionObject)
    (exception_type_length, exception_type) = string_to_message(exception_type_name)
    (exception_message_length, exception_message) = string_to_message(exception_message)

    message = [
        object_type,
        exception_type_length,
        exception_type,
        exception_message_length,
        exception_message,
    ]

    # Create the message format string
    message_format = f"!BI{exception_type_length}sI{exception_message_length}s"

    # Pack the message
    message_pack = struct.pack(message_format, *message)

    return message_pack

    # Create the message body
    exception_type = ExceptionTypes.get(type(exception), ExceptionTypes[None])
    exception_message = traceback.format_exc().encode()

    # Create the message
    message = [
        message_type,
        request_id,
        object_id,
        object_type,
        exception_type,
        exception_message,
    ]

    # Create the message format string
    message_format = f"!BIIBB{len(exception_message)}s"

    # Pack the message
    message_pack = struct.pack(message_format, *message)

    return message_pack


def message_chunks(
    message_length,
    message_id,
    request_id,
    message,
):
    loc = 0
    chunk_count = len(message) // CHUNK_SIZE + 1
    for chunk_index in range(chunk_count):
        data = message[loc : loc + CHUNK_SIZE]
        chunk_length = len(data)
        header = chunk_header(
            message_length,
            message_id,
            request_id,
            chunk_count,
            chunk_index,
            chunk_length,
        )
        loc += CHUNK_SIZE
        yield header + data


class _Internal:
    @staticmethod
    def is_numpy_array(obj):
        return isinstance(obj, np.ndarray)

    @staticmethod
    def is_numpy_tensor(obj):
        return _Internal.is_numpy_array(obj) and (len(obj.shape) == 4)

    @staticmethod
    def is_pillow_image(img):
        try:
            import PIL.Image

            return isinstance(img, PIL.Image.Image)
        except TypeError:
            return False

    @staticmethod
    def is_torch(obj):
        try:
            import torch

            return isinstance(obj, torch.Tensor)
        except ImportError:
            return False
    
    @staticmethod
    def torch_to_numpy(tensor):
        tensor = tensor.detach().cpu()
        if hasattr(tensor, "resolve_conj"):
            tensor = tensor.resolve_conj()
        if hasattr(tensor, "resolve_neg"):
            tensor = tensor.resolve_neg()
        return tensor.numpy()


def open_send_and_close(port, request_id, obj, options=None):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect(("localhost", port))

        try:
            if _Internal.is_numpy_array(obj):
                if _Internal.is_numpy_tensor(obj):
                    message = create_tensor_message(obj, options)
                else:
                    message = create_numpy_message(obj)
            elif _Internal.is_pillow_image(obj):
                message = create_pillow_message(obj)
            elif _Internal.is_torch(obj):
                message = create_tensor_message(obj, options)
            else:
                raise ValueError(f"Cant send object of type {type(obj)}")
        except Exception as e:
            message = create_exception_message(e)

        message_length = len(message)

        # Send the message data
        message_id = generate_message_id()
        # print(f'Sending message {message_id}')
        chunks = message_chunks(message_length, message_id, request_id, message)

        all_data = b""

        # Send the message
        for chunk in chunks:
            s.sendall(chunk)
            all_data += chunk

        # Close the socket
        s.close()
