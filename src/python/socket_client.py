import socket
import sys
import traceback
import struct
import numpy as np

CHUNK_SIZE = 4 * 1024  # 4KB

# See webview/communication/protocol.ts for message format
PythonSender = 0x02
# MessageType 
PythonSendingObject = 0x01
# ObjectType
NumpyArray = 0x01
Json = 0x02
ExceptionObject = 0xff
# ByteOrderType
LittleEndian = 0x01
BigEndian = 0x02
# ArrayDataType
Float32 = 0x01
Float64 = 0x02
Int8 = 0x03
Int16 = 0x04
Int32 = 0x05
Int64 = 0x06
Uint8 = 0x07
Uint16 = 0x08
Uint32 = 0x09
Uint64 = 0x0a
Bool = 0x0b
# ExceptionType
ExceptionTypes = {
    BaseException: 0x01,
    Exception: 0x02,
    RuntimeError: 0x03,
    TypeError: 0x04,
    ValueError: 0x05,
    None: 0xff,  # Unknown exception
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
NumDimsType = np.uint8
DimType = np.uint32
ByteOrderType = np.uint8

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

BYTE_ORDER = LittleEndian if sys.byteorder == 'little' else BigEndian

def generate_message_id():
    return np.random.randint(0, 2**32, dtype=np.uint32)

def chunk_header(
    message_length,
    message_id,
    request_id,
    chunk_count,
    chunk_index,
    chunk_length,
):
    message_length = MessageLengthType(message_length)
    message_id  = MessageIdType(message_id)
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
    header_format = f'!IIBIBIII'

    return struct.pack(header_format, *header)

def create_numpy_message(
    array: np.ndarray,
):

    object_type = ObjectType(NumpyArray)
    array_dtype =   array_dtype_to_array_data_type[str(array.dtype)]
    byte_order =    ByteOrderType(BYTE_ORDER)
    num_dimensions = NumDimsType(len(array.shape))
    array_shape =   np.array(array.shape, dtype=DimType)
    array_data =    array.tobytes()

    metadata = [
        object_type,
        array_dtype,
        byte_order,
        num_dimensions,
        *array_shape,
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
    message_format = f'!BBBB{num_dimensions}I{len(array_data)}s'

    # Pack the message
    message_pack = struct.pack(message_format, *message)

    return message_pack

def create_pillow_message(
    image,
):
    image_np = np.asarray(image)
    return create_numpy_message(image_np)

def create_exception_message(
    exception: Exception,
):
    # Create the message header
    message_type = MessageType(PythonSendingObject)
    request_id = RequestIdType(request_id)
    object_id = ObjectIdType(id(exception))
    object_type = ObjectType(ExceptionObject)

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
    message_format = f'!BIIBB{len(exception_message)}s'

    # Pack the message
    message_pack = struct.pack(message_format, *message)

    return message_pack

def create_json_message(
    request_id: RequestIdType,
    obj: str,
):
    # Create the message header
    message_type = MessageType(PythonSendingObject)
    request_id = RequestIdType(request_id)
    object_id = ObjectIdType(id(obj))
    object_type = ObjectType(Json)

    # Create the message body
    json_message = obj.encode()
    
    # Create the message
    message = [
        message_type,
        request_id,
        object_id,
        object_type,
        json_message,
    ]

    # Create the message format string
    message_format = f'!BIIB{len(json_message)}s'

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
        data = message[loc:loc+CHUNK_SIZE]
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


def open_send_and_close(port, request_id, obj):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect(('localhost', port))

        try:
            if isinstance(obj, np.ndarray):
                message = create_numpy_message(obj)
            elif is_pillow_image(obj):
                message = create_pillow_message(obj)
            else:
                raise ValueError(f'Cant send object of type {type(obj)}')
        except Exception as e:
            # message = create_exception_message(e)
            import traceback
            traceback.print_exc()
            return
        
        message_length = len(message)

        # Send the message data
        message_id = generate_message_id()
        # print(f'Sending message {message_id}')
        chunks = message_chunks(message_length, message_id, request_id, message)

        all_data = b''

        # Send the message
        for chunk in chunks:
            s.sendall(chunk)
            all_data += chunk

        # print(f'Sent {len(all_data)} bytes')
        # buffer = list(np.frombuffer(all_data, dtype=np.uint8))
        # print([hex(x) for x in buffer])

        # Close the socket
        s.close()